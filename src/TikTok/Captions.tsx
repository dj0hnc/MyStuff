import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Props = { readonly phrases: string[]; readonly accent: string };

// Subtítulos estilo TikTok: una frase a la vez, cada palabra se
// enciende en secuencia y la palabra activa hace un pequeño "pop".
export const Captions: React.FC<Props> = ({ phrases, accent }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const totalWords = phrases.reduce((n, p) => n + p.split(" ").length, 0);
  const framesPerWord = durationInFrames / totalWords;

  // Encontrar la frase activa según cuántas palabras han pasado.
  let wordsBefore = 0;
  let phraseIndex = 0;
  for (let i = 0; i < phrases.length; i++) {
    const count = phrases[i].split(" ").length;
    if (frame < (wordsBefore + count) * framesPerWord) {
      phraseIndex = i;
      break;
    }
    wordsBefore += count;
    phraseIndex = i;
  }

  const words = phrases[phraseIndex].split(" ");
  const phraseStart = wordsBefore * framesPerWord;
  const localFrame = frame - phraseStart;
  const activeWord = Math.min(
    words.length - 1,
    Math.floor(localFrame / framesPerWord),
  );

  const phraseEnter = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 160 },
  });
  const phraseY = interpolate(phraseEnter, [0, 1], [60, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 70px",
      }}
    >
      <div
        style={{
          transform: `translateY(${phraseY}px)`,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "10px 22px",
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          fontWeight: 900,
          fontSize: 96,
          lineHeight: 1.1,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {words.map((word, i) => {
          const wordStart = i * framesPerWord;
          const pop = spring({
            frame: localFrame - wordStart,
            fps,
            config: { damping: 10, stiffness: 200 },
          });
          const isActive = i === activeWord;
          const isPast = i < activeWord;
          const scale = isActive ? interpolate(pop, [0, 1], [0.8, 1.12]) : 1;
          const color = isActive ? accent : isPast ? "white" : "rgba(255,255,255,0.35)";

          return (
            <span
              key={`${phraseIndex}-${i}`}
              style={{
                display: "inline-block",
                transform: `scale(${scale})`,
                color,
                textShadow: isActive
                  ? `0 0 40px ${accent}66, 0 10px 30px rgba(0,0,0,0.5)`
                  : "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
