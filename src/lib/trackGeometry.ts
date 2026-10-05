/** Reflect absolute SVG track commands without changing arc radii or flags. */
export function mirrorTrackPath(path: string, width = 800): string {
  return path.replace(/([MLQCAZ])([^MLQCAZ]*)/g, (_, command: string, values: string) => {
    if (command === "Z") return command;
    const numbers = values.trim().split(/[\s,]+/).map(Number);
    if (command === "A") {
      for (let i = 0; i < numbers.length; i += 7) {
        numbers[i + 2] = -numbers[i + 2]; // Axis rotation reflects too.
        numbers[i + 4] = 1 - numbers[i + 4]; // Reverse the arc sweep.
        numbers[i + 5] = width - numbers[i + 5];
      }
    } else {
      for (let i = 0; i < numbers.length; i += 2) numbers[i] = width - numbers[i];
    }
    return `${command} ${numbers.join(" ")} `;
  }).trim();
}
