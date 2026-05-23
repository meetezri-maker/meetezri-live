export function formatSessionTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getConnectionQualityColor(
  quality: "excellent" | "good" | "poor"
): string {
  switch (quality) {
    case "excellent":
      return "text-green-400";
    case "good":
      return "text-yellow-400";
    case "poor":
      return "text-red-400";
  }
}
