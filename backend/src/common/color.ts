/** Contraste WCAG 2.1 entre dos colores hex (#RRGGBB). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Pares de color de marca que deben pasar AA (4,5:1) sobre el fondo oscuro de Nivia. */
export function brandingContrastIssues(b: { accent: string; on_accent: string; principal: string; principal_text: string }) {
  const BG = '#0E0F11', SURFACE = '#1A1C20', LIGHT = '#F2F2F0';
  const checks: [string, string, string][] = [
    ['acento sobre fondo', b.accent, BG],
    ['texto sobre acento', b.on_accent, b.accent],
    ['texto claro sobre principal', LIGHT, b.principal],
    ['texto de enlace sobre superficie', b.principal_text, SURFACE]
  ];
  return checks
    .map(([name, fg, bg]) => ({ name, ratio: Math.round(contrastRatio(fg, bg) * 10) / 10 }))
    .filter((c) => c.ratio < 4.5);
}
