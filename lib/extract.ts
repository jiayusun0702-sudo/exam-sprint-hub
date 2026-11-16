/*
 * Text extraction runs in the browser, so only text (not the original files)
 * is sent to the server: smaller uploads, lower model cost, and the student's
 * files never leave their device.
 */

export type Extracted = { name: string; text: string; pages: number };

async function pdfText(buf: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else line += " ";
    }
    if (line.trim()) lines.push(line);
    parts.push(`[Page ${p}]\n${lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n")}`);
  }
  return { text: parts.join("\n\n"), pages: doc.numPages };
}

async function docxText(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value;
}

export async function extractFile(file: File): Promise<Extracted> {
  const buf = await file.arrayBuffer();
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { text, pages } = await pdfText(buf);
    return { name: file.name, text, pages };
  }
  if (lower.endsWith(".docx")) return { name: file.name, text: await docxText(buf), pages: 0 };
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return { name: file.name, text: new TextDecoder().decode(buf), pages: 0 };
  throw new Error(`不支持的文件类型 Unsupported file type: ${file.name}`);
}

export type Role = "syllabus" | "lecture" | "case" | "answer" | "skip";

/** Best guess of what a file is from its name; the student can change it. */
export function guessRole(name: string): Role {
  const n = name.toLowerCase();
  if (/(syllabus|outline|course ?guide|大纲|课程介绍)/.test(n)) return "syllabus";
  if (/(model ?answer|answer|solution|参考答案|答案)/.test(n)) return "answer";
  if (/(case|案例)/.test(n)) return "case";
  return "lecture";
}

export const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
