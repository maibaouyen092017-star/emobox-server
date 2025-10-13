// utils/mixAudio.js
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

export async function mixAudio(voicePath, musicPath, outputName) {
  const outputDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${outputName}.wav`);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(voicePath)
      .input(musicPath)
      .complexFilter([
        "[0:a]volume=1.5[a0]",
        "[1:a]volume=0.5[a1]",
        "[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2[aout]"
      ])
      .outputOptions([
        "-acodec pcm_s16le", // WAV PCM 16-bit
        "-ar 16000",         // 16 kHz
        "-ac 1"              // mono
      ])
      .output(outputPath)
      .on("end", () => resolve(`/uploads/${outputName}.wav`))
      .on("error", reject)
      .run();
  });
}
