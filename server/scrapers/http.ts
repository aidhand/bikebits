import * as cheerio from "cheerio";
import { chromium } from "playwright";
import type { Browser } from "playwright";

const USER_AGENT = "BikeBitsBot (+https://bikebits.au; price index)";
const FETCH_TIMEOUT_MS = 15_000;

const lastRequestAt = new Map<string, number>();
const robotsCache = new Map<string, string>();

export function parseHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

async function hostDelay(host: string): Promise<void> {
  const last = lastRequestAt.get(host) ?? 0;
  const wait = last + 1000 - Date.now();
  if (wait > 0) {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, wait);
    await promise;
  }
  lastRequestAt.set(host, Date.now());
}

async function getRobotsTxt(origin: string): Promise<string> {
  const cached = robotsCache.get(origin);
  if (cached !== undefined) return cached;
  let body = "";
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) body = await res.text();
  } catch {
    body = "";
  }
  robotsCache.set(origin, body);
  return body;
}

interface RobotsGroup {
  agents: string[];
  rules: { type: "allow" | "disallow"; path: string }[];
}

function parseRobots(robots: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  for (const line of robots.split(/\r?\n/)) {
    const clean = line.replace(/#.*$/, "").trim();
    if (!clean) continue;
    const m = clean.match(/^([^:]+):(.*)$/i);
    if (!m?.[1] || !m[2]) continue;
    const field = m[1].trim().toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (current?.agents.length && current.rules.length) {
        current = null;
      }
      if (!current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
      continue;
    }
    if (!current) continue;
    if (field === "allow" && value) {
      current.rules.push({ type: "allow", path: value });
    } else if (field === "disallow" && value) {
      current.rules.push({ type: "disallow", path: value });
    }
  }
  return groups;
}

export async function robotsAllowed(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const robots = await getRobotsTxt(parsed.origin);
  if (!robots) return true;

  const groups = parseRobots(robots);
  const botName = "bikebitsbot";
  const group =
    groups.find((g) => g.agents.some((a) => a.toLowerCase().includes(botName))) ??
    groups.find((g) => g.agents.includes("*"));
  if (!group) return true;

  const path = parsed.pathname + parsed.search;
  let disallowed = false;
  let allowed = false;
  for (const rule of group.rules) {
    if (path.startsWith(rule.path)) {
      if (rule.type === "disallow") disallowed = true;
      else allowed = true;
    }
  }
  return allowed || !disallowed;
}

export async function fetchStatic(url: string): Promise<string> {
  if (!(await robotsAllowed(url))) {
    throw new Error(`robots.txt disallows: ${url}`);
  }
  await hostDelay(new URL(url).host);
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({ args: ["--no-sandbox"] });
  }
  return sharedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export async function fetchRendered(url: string): Promise<string> {
  if (!(await robotsAllowed(url))) {
    throw new Error(`robots.txt disallows: ${url}`);
  }
  await hostDelay(new URL(url).host);
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    return await page.content();
  } finally {
    await page.close();
  }
}
