import { describe, expect, it } from "vitest";
import { searchKnowledge } from "./knowledge";
import {
  PROMPT_CATALOGUE,
  PROMPT_CATEGORIES,
  capabilitySummary,
  promptsByCategory,
} from "./prompts";

describe("prompt catalogue", () => {
  it("gives every prompt a unique id and a known category", () => {
    const ids = new Set<string>();
    const cats = new Set(PROMPT_CATEGORIES.map((c) => c.key));
    for (const p of PROMPT_CATALOGUE) {
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false);
      ids.add(p.id);
      expect(cats.has(p.category), `unknown category ${p.category}`).toBe(true);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.prompt.length).toBeGreaterThan(0);
    }
  });

  it("has at least one prompt in every category", () => {
    for (const c of PROMPT_CATEGORIES) {
      expect(promptsByCategory(c.key).length, `category ${c.key} is empty`).toBeGreaterThan(0);
    }
  });

  it("summarizes capabilities with real example prompts for the model", () => {
    const summary = capabilitySummary();
    for (const c of PROMPT_CATEGORIES) expect(summary).toContain(c.title);
    // Example phrasings are quoted verbatim from the catalogue.
    expect(summary).toContain(`"${PROMPT_CATALOGUE[0]!.prompt}"`);
  });
});

describe("searchKnowledge", () => {
  it("finds the out-of-office article for a time-off question", () => {
    const [top] = searchKnowledge("how do I set myself out of office while on vacation?");
    expect(top?.id).toBe("availability");
  });

  it("finds the no-shows article for an attendance question", () => {
    const [top] = searchKnowledge("what's the best way to cut down on no-shows?");
    expect(top?.id).toBe("no-shows");
  });

  it("ranks calendar-sync questions to the calendars article", () => {
    const [top] = searchKnowledge("connect my google and outlook calendars for conflict checking");
    expect(top?.id).toBe("calendars");
  });

  it("returns nothing for an empty / stopword-only query", () => {
    expect(searchKnowledge("how do I")).toEqual([]);
    expect(searchKnowledge("")).toEqual([]);
  });

  it("caps results at the requested limit", () => {
    expect(
      searchKnowledge("meeting booking availability calendar team focus", 2).length,
    ).toBeLessThanOrEqual(2);
  });
});
