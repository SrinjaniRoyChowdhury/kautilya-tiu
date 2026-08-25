import { describe, expect, it } from "vitest";
import { parsePortfolioMatrix, parseTabularFile, toSpreadsheetXml } from "./sheet";

describe("sheet helpers", () => {
  it("parses a CSV portfolio matrix", () => {
    const csv = "SLR No.,Portfolio\n1,France\n2,India\n";
    expect(parsePortfolioMatrix(new TextEncoder().encode(csv))).toEqual([
      { slr: 1, name: "France" },
      { slr: 2, name: "India" },
    ]);
  });

  it("parses tab-separated rows without a header match as slr + name", () => {
    const text = "1\tGermany\n2\tJapan\n";
    expect(parseTabularFile(new TextEncoder().encode(text))).toEqual([
      ["1", "Germany"],
      ["2", "Japan"],
    ]);
  });

  it("emits spreadsheet xml that Excel can open", () => {
    const xml = toSpreadsheetXml(["No", "Name"], [[1, "Ada"]]);
    expect(xml).toContain("Excel.Sheet");
    expect(xml).toContain("Ada");
  });

  it("round-trips a portfolio matrix through spreadsheet xml", () => {
    const xml = toSpreadsheetXml(["SLR No.", "Portfolio"], [[1, "France"], [2, "India"]]);
    expect(parsePortfolioMatrix(new TextEncoder().encode(xml))).toEqual([
      { slr: 1, name: "France" },
      { slr: 2, name: "India" },
    ]);
  });
});
