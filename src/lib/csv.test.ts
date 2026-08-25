import { describe, expect, it } from "vitest";
import { csvEscape, safeCsvFilename, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas and doubled quotes", () => {
    expect(csvEscape('a, "b"')).toBe('"a, ""b"""');
  });

  it("builds CRLF rows", () => {
    expect(toCsv(["name", "n"], [["Ada", 1]])).toBe("name,n\r\nAda,1\r\n");
  });

  it("strips path characters from download names", () => {
    expect(safeCsvFilename("../../etc/passwd.csv")).toBe("etc_passwd.csv");
  });
});
