// Cores das frequências "diferentes de semanal" — usadas na legenda e nos
// chips da Agenda (gerência e funcionário) para se perceber o ritmo do
// cliente à primeira vista.
export const FREQ_STYLE = {
  biweekly: { bg: "#EFE9FA", ink: "#5B3FA0" }, // violeta
  monthly: { bg: "#E3EEFA", ink: "#1D5FA8" }, // azul
  alternate: { bg: "#FFF1CF", ink: "#8A5A00" }, // âmbar
};
export const isRecurringFreq = (f) => f === "biweekly" || f === "monthly" || f === "alternate";
