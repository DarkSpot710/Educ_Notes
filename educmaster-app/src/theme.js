export const COLORS = {
  chalk: "#1F3D2E",
  chalkLight: "#2C4F3B",
  paper: "#F6F4EC",
  stamp: "#A23E2C",
  ink: "#2B4570",
  line: "#C9C4B4",
  text: "#22261F",
  muted: "#6B7268",
};

export function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
