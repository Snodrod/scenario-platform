import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import path from "path";

// The base-14 PDF fonts (Helvetica etc.) only cover Latin/WinAnsi — every
// Cyrillic character renders as garbage glyphs. Register a font that
// actually has Cyrillic coverage. Resolved via process.cwd() (not a
// bundler-relative path) because Next.js only copies `public/` verbatim;
// this stays correct both in `next dev` and on Vercel.
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
let fontsRegistered = false;
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: path.join(FONT_DIR, "NotoSans-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(FONT_DIR, "NotoSans-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  fontsRegistered = true;
}

export interface PdfShot {
  orderIndex: number;
  imageUrl: string | null;
  lineText: string | null;
  emotionNotes: string | null;
  editingNotes: string | null;
  soundNotes: string | null;
  durationSeconds: number | null;
}

export interface PdfScene {
  orderIndex: number;
  title: string | null;
  summary: string | null;
  shots: PdfShot[];
}

export interface PdfProps {
  projectName: string;
  scenes: PdfScene[];
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Noto Sans" },
  title: { fontSize: 18, marginBottom: 4, fontFamily: "Noto Sans", fontWeight: "bold" },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 18 },
  sceneHeader: { fontSize: 13, fontFamily: "Noto Sans", fontWeight: "bold", marginTop: 16, marginBottom: 4 },
  sceneSummary: { fontSize: 9, color: "#555", marginBottom: 8 },
  shotRow: { flexDirection: "row", gap: 10, marginBottom: 10, borderBottom: "1 solid #eee", paddingBottom: 10 },
  thumb: { width: 160, height: 90, objectFit: "cover", backgroundColor: "#111" },
  thumbPlaceholder: { width: 160, height: 90, backgroundColor: "#eee" },
  shotInfo: { flex: 1 },
  shotLabel: { fontSize: 8, color: "#888", marginTop: 4 },
  shotLine: { fontSize: 10, fontFamily: "Noto Sans", fontWeight: "bold", marginBottom: 2 },
  shotText: { fontSize: 9, color: "#333" },
});

export function StoryboardDocument({ projectName, scenes }: PdfProps) {
  ensureFontsRegistered();
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{projectName}</Text>
        <Text style={styles.subtitle}>Раскадровка — экспортировано из Scenario Platform</Text>

        {scenes.map((scene) => (
          <View key={scene.orderIndex} wrap={false}>
            <Text style={styles.sceneHeader}>
              Сцена {scene.orderIndex + 1}. {scene.title}
            </Text>
            {scene.summary ? <Text style={styles.sceneSummary}>{scene.summary}</Text> : null}

            {scene.shots.map((shot) => (
              <View key={shot.orderIndex} style={styles.shotRow} wrap={false}>
                {shot.imageUrl ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={shot.imageUrl} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbPlaceholder} />
                )}
                <View style={styles.shotInfo}>
                  <Text style={styles.shotText}>
                    Кадр {shot.orderIndex + 1}
                    {shot.durationSeconds ? ` · ${shot.durationSeconds} сек` : ""}
                  </Text>
                  {shot.lineText ? <Text style={styles.shotLine}>«{shot.lineText}»</Text> : null}
                  {shot.emotionNotes ? (
                    <>
                      <Text style={styles.shotLabel}>ЭМОЦИЯ И ПОДАЧА</Text>
                      <Text style={styles.shotText}>{shot.emotionNotes}</Text>
                    </>
                  ) : null}
                  {shot.editingNotes ? (
                    <>
                      <Text style={styles.shotLabel}>ТЗ К МОНТАЖУ</Text>
                      <Text style={styles.shotText}>{shot.editingNotes}</Text>
                    </>
                  ) : null}
                  {shot.soundNotes ? (
                    <>
                      <Text style={styles.shotLabel}>ЗВУК</Text>
                      <Text style={styles.shotText}>{shot.soundNotes}</Text>
                    </>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
