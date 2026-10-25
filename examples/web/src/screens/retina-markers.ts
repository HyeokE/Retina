export type RetinaScreen = 'profile' | 'edit'

// Ready marker for a screen root. In production builds __RETINA_TEST_MODE__ is
// the literal false, so this returns {} and the attribute name never reaches
// the bundle.
export function retinaReadyAttributes(screen: RetinaScreen): Readonly<Record<string, string>> {
  return __RETINA_TEST_MODE__ ? { 'data-retina-ready': screen } : {}
}
