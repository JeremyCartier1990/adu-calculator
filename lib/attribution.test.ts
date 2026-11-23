import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { CLICK_STORE_KEY, readClickId } from "./redtrack";
import {
  captureAttribution,
  ensureClickId,
  parseAttribution,
  readAttribution,
  readAttributionForLead,
  resetClickCaptureForTests,
} from "./attribution";

type Browser = {
  cookieWrites: string[];
  store: Map<string, string>;
  setUrl: (href: string) => void;
};

const original = {
  window: globalThis.window,
  document: globalThis.document,
  fetch: globalThis.fetch,
};

function installBrowser(href: string): Browser {
  const jar = new Map<string, string>();
  const cookieWrites: string[] = [];
  const store = new Map<string, string>();
  const session = new Map<string, string>();
  const location = { href: "", search: "", hostname: "", protocol: "https:" };
  const win = {
    location,
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
    sessionStorage: {
      getItem: (key: string) => (session.has(key) ? session.get(key)! : null),
      setItem: (key: string, value: string) => {
        session.set(key, String(value));
      },
    },
    rtkClickID: undefined as string | undefined,
    rtkxhr: undefined as { readyState: number; status?: number; responseText?: string } | undefined,
  };
  const doc = {
    referrer: "https://facebook.com/ad",
    get cookie() {
      return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
    },
    set cookie(value: string) {
      cookieWrites.push(value);
      const pair = value.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq === -1) return;
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    },
  };
  Object.assign(globalThis, { window: win, document: doc });
  const browser: Browser = {
    cookieWrites,
    store,
    setUrl(next) {
      const url = new URL(next);
      location.href = url.href;
      location.search = url.search;
      location.hostname = url.hostname;
      location.protocol = url.protocol;
    },
  };
  browser.setUrl(href);
  return browser;
}

function restoreBrowser() {
  resetClickCaptureForTests();
  globalThis.window = original.window;
  globalThis.document = original.document;
  globalThis.fetch = original.fetch;
  mock.timers.reset();
}

/** Fake-timer step, then let the click-id promise settle. Node 22's mock timers have tick, not tickAsync. */
async function advance(ms: number) {
  mock.timers.tick(ms);
  await new Promise((resolve) => setImmediate(resolve));
}

test("readClickId checks rtkcid, clickid, rtkclickid, then rt_clickid", () => {
  const browser = installBrowser("https://aduroicalculator.com/?rt_clickid=fourth&rtkclickid=third&clickid=second&rtkcid=first");
  try {
    assert.equal(readClickId(), "first");
    browser.setUrl("https://aduroicalculator.com/?rt_clickid=fourth&rtkclickid=third&clickid=second");
    assert.equal(readClickId(), "second");
    browser.setUrl("https://aduroicalculator.com/?rtkclickid=third&rt_clickid=fourth");
    assert.equal(readClickId(), "third");
    browser.setUrl("https://aduroicalculator.com/?rt_clickid=fourth");
    assert.equal(readClickId(), "fourth");
    browser.setUrl("https://aduroicalculator.com/?rtkcid=&clickid=from-alias");
    assert.equal(readClickId(), "from-alias");
    browser.setUrl("https://aduroicalculator.com/?rtkcid=%20%20");
    assert.equal(readClickId(), null);
  } finally {
    restoreBrowser();
  }
});

test("readClickId falls through to the rtkclickid-store cookie, then localStorage", () => {
  const browser = installBrowser("https://aduroicalculator.com/");
  try {
    browser.store.set(CLICK_STORE_KEY, "from-storage");
    assert.equal(readClickId(), "from-storage");
    document.cookie = `${CLICK_STORE_KEY}=${encodeURIComponent("from-cookie")}; Path=/`;
    assert.equal(readClickId(), "from-cookie");
    browser.setUrl("https://aduroicalculator.com/?clickid=from-url");
    assert.equal(readClickId(), "from-url");
    document.cookie = `${CLICK_STORE_KEY}=undefined; Path=/`;
    browser.store.set(CLICK_STORE_KEY, "from-storage");
    browser.setUrl("https://aduroicalculator.com/");
    assert.equal(readClickId(), "from-storage");
  } finally {
    restoreBrowser();
  }
});

test("captureAttribution normalizes a click id alias and stores a first-party cookie on aduroicalculator.com", () => {
  const browser = installBrowser("https://aduroicalculator.com/?clickid=TESTCLICK123&cmpid=TESTCMP&sub1=creative&utm_source=facebook");
  try {
    captureAttribution();
    const kept = readAttribution();
    assert.equal(kept?.rtkcid, "TESTCLICK123");
    assert.equal(kept?.clickid, "TESTCLICK123");
    assert.equal(kept?.cmpid, "TESTCMP");
    assert.equal(kept?.sub1, "creative");
    assert.equal(kept?.utm_source, "facebook");
    assert.equal(browser.store.get(CLICK_STORE_KEY), "TESTCLICK123");
    const wrote = browser.cookieWrites.at(-1) ?? "";
    assert.match(wrote, new RegExp(`^${CLICK_STORE_KEY}=TESTCLICK123;`));
    assert.match(wrote, /Domain=aduroicalculator.com/);
    assert.match(wrote, /SameSite=Lax/);
    assert.match(wrote, /Secure/);
    assert.equal(document.cookie, `${CLICK_STORE_KEY}=TESTCLICK123`);

    browser.setUrl("https://www.aduroicalculator.com/?rtkclickid=on-www");
    captureAttribution();
    assert.match(browser.cookieWrites.at(-1) ?? "", /Domain=aduroicalculator.com/);
    assert.equal(readAttribution()?.rtkcid, "on-www");
  } finally {
    restoreBrowser();
  }
});

test("the click cookie is host-only off the public domain, and a later page keeps the saved click", () => {
  const browser = installBrowser("https://adu-calculator-git-preview.vercel.app/?cmpid=TESTCMP&clickid=TESTCLICK123&sub2=two");
  try {
    captureAttribution();
    const wrote = browser.cookieWrites.at(-1) ?? "";
    assert.doesNotMatch(wrote, /Domain=/);
    assert.match(wrote, /SameSite=Lax/);
    browser.setUrl("https://adu-calculator-git-preview.vercel.app/team");
    captureAttribution();
    browser.setUrl("https://adu-calculator-git-preview.vercel.app/");
    captureAttribution();
    const kept = readAttribution();
    assert.equal(kept?.rtkcid, "TESTCLICK123");
    assert.equal(kept?.cmpid, "TESTCMP");
    assert.equal(kept?.sub2, "two");
    assert.equal(readClickId(), "TESTCLICK123");
  } finally {
    restoreBrowser();
  }
});

test("a new cmpid does not reuse the previous click id", async (t) => {
  t.after(restoreBrowser);
  const browser = installBrowser("https://aduroicalculator.com/?rtkcid=old-click&cmpid=OLD");
  captureAttribution();
  await ensureClickId();
  assert.equal(readAttribution()?.rtkcid, "old-click");

  mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;
  browser.setUrl("https://aduroicalculator.com/?cmpid=NEWCMP&sub1=next");
  captureAttribution();
  assert.equal(readAttribution()?.rtkcid, undefined);
  assert.equal(readAttribution()?.cmpid, "NEWCMP");
  const kept = await (async () => {
    const pending = readAttributionForLead();
    await advance(4100);
    return pending;
  })();
  assert.equal(kept?.rtkcid, undefined);
  assert.equal(kept?.cmpid, "NEWCMP");
  assert.equal(kept?.sub1, "next");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/NEWCMP\?/);
  const again = await ensureClickId();
  assert.equal(again, null);
  assert.equal(calls.length, 1);
});

test("cmpid without a click id waits for the script and does not fetch when the script resolves", async (t) => {
  t.after(restoreBrowser);
  installBrowser("https://aduroicalculator.com/?cmpid=CAMP123&sub3=three");
  mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
  let fetches = 0;
  globalThis.fetch = (async () => {
    fetches += 1;
    return new Response(JSON.stringify({ clickid: "should-not-be-used" }), { status: 200 });
  }) as typeof fetch;
  const view = window as Window & { rtkClickID?: string; rtkxhr?: { readyState: number; status?: number; responseText?: string } };
  view.rtkxhr = { readyState: 2, status: 0, responseText: "" };
  captureAttribution();
  const pending = ensureClickId();
  await advance(150);
  view.rtkClickID = "from-script";
  view.rtkxhr = { readyState: 4, status: 200, responseText: JSON.stringify({ clickid: "from-script" }) };
  await advance(150);
  assert.equal(await pending, "from-script");
  assert.equal(fetches, 0);
  assert.equal(readAttribution()?.rtkcid, "from-script");
  assert.equal(readAttribution()?.sub3, "three");
});

test("an in-flight uniclick request is not repeated", async (t) => {
  t.after(restoreBrowser);
  installBrowser("https://aduroicalculator.com/?cmpid=CAMP123&sub4=four");
  mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
  let fetches = 0;
  globalThis.fetch = (async () => {
    fetches += 1;
    return new Response(JSON.stringify({ clickid: "fallback" }), { status: 200 });
  }) as typeof fetch;
  const view = window as Window & { rtkxhr?: { readyState: number } };
  view.rtkxhr = { readyState: 1 };
  captureAttribution();
  const id = ensureClickId();
  await advance(4100);
  assert.equal(await id, null);
  assert.equal(fetches, 0);
  assert.equal(readAttribution()?.rtkcid, undefined);
});

test("one fallback fetch reads clickid and a CORS failure does not throw", async (t) => {
  t.after(restoreBrowser);
  installBrowser("https://aduroicalculator.com/?cmpid=TESTCMP&sub1=a&sub8=h&utm_source=fb");
  mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ clickid: "fetched-click" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  captureAttribution();
  const id = await (async () => {
    const pending = ensureClickId();
    await advance(4100);
    return pending;
  })();
  assert.equal(id, "fetched-click");
  assert.equal(calls.length, 1);
  const endpoint = new URL(calls[0]);
  assert.equal(endpoint.origin + endpoint.pathname, "https://tracking.zip-estimate.com/TESTCMP");
  assert.equal(endpoint.searchParams.get("format"), "json");
  assert.equal(endpoint.searchParams.get("cmpid"), "TESTCMP");
  assert.equal(endpoint.searchParams.get("sub1"), "a");
  assert.equal(endpoint.searchParams.get("sub8"), "h");
  assert.equal(endpoint.searchParams.get("referrer"), "https://facebook.com/ad");
  assert.equal(readAttribution()?.rtkcid, "fetched-click");
  assert.equal(readClickId(), "fetched-click");
  const parsed = JSON.parse(window.localStorage.getItem("lead-attribution") ?? "{}") as { rtkcid?: string; cmpid?: string };
  assert.equal(parsed.rtkcid, "fetched-click");
  assert.equal(parsed.cmpid, "TESTCMP");

  resetClickCaptureForTests();
  installBrowser("https://aduroicalculator.com/?cmpid=OTHER1");
  const failed: string[] = [];
  globalThis.fetch = (async (url: string) => {
    failed.push(String(url));
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;
  const pending = ensureClickId();
  await advance(4100);
  assert.equal(await pending, null);
  assert.equal(failed.length, 1);
  await assert.doesNotReject(ensureClickId());
  assert.equal(failed.length, 1);
});

test("parseAttribution copies the first click id alias onto rtkcid and drops unknown keys", () => {
  const parsed = parseAttribution({ rt_clickid: " zz ", clickid: "earlier", cmpid: "C", sub2: "two", evil: "1" });
  assert.equal(parsed?.rtkcid, "earlier");
  assert.equal(parsed?.clickid, "earlier");
  assert.equal(parsed?.rt_clickid, "zz");
  assert.equal(parsed?.cmpid, "C");
  assert.equal(parsed?.sub2, "two");
  assert.equal(parsed && "evil" in parsed, false);
  assert.equal(parseAttribution({ rtkcid: "kept", clickid: "other" })?.rtkcid, "kept");
  assert.equal(parseAttribution({}), null);
});
