import wordleData from "../../../data/wordle.json";
import WordleGame from "@/components/games/WordleGame";
import GamePageWrapper from "@/components/ui/GamePageWrapper";

export default function WhichSongPage() {
  return (
    <GamePageWrapper
      title="וורדעל"
      icon="⬜"
      subtitle="נחשו את המילה בסגנון משחק המילים של הארץ."
    >
      <WordleGame data={wordleData} />
    </GamePageWrapper>
  );
}
