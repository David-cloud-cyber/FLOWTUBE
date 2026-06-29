export function parseSse(buffer: string) {
  const events: Array<{ event: string; data: any }> = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";

  for (const block of blocks) {
    const event = block
      .split("\n")
      .find((line) => line.startsWith("event:"))
      ?.replace("event:", "")
      .trim();
    const data = block
      .split("\n")
      .find((line) => line.startsWith("data:"))
      ?.replace("data:", "")
      .trim();
    if (!event || !data) continue;
    try {
      events.push({ event, data: JSON.parse(data) });
    } catch {
      events.push({ event, data });
    }
  }

  return { events, rest };
}
