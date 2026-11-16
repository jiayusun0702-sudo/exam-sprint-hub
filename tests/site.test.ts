import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderSite, buildSiteData } from "../lib/site";
import { demoInput } from "./fixtures/demo";

const template = readFileSync(new URL("../public/site-template.html", import.meta.url), "utf8");

test("site renders with data injected and no script breakout", () => {
  const html = renderSite(template, demoInput);
  assert.ok(!html.includes("/*__SITE_DATA__*/"));
  // The case title contains "<script>": it must be escaped inside the JSON.
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.equal((html.match(/<script>/g) || []).length, 1);
});

test("course strings shown via innerHTML are escaped", () => {
  const d = buildSiteData({ ...demoInput, overview: { ...demoInput.overview!, course_title_en: "<img src=x onerror=alert(1)>" } });
  assert.ok(!JSON.stringify(d.I.en).includes("<img"));
  assert.equal(d.QUIZ.length, 3);
  assert.equal(Object.keys(d.KNOWLEDGE).length, 2);
});
