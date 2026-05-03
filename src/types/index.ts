export interface VideoClip {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  description: string;
  viralScore: number;
  hashtags: string[];
  outputPath?: string;
  status: "pending" | "processing" | "done" | "error";
}

export interface AnalysisResult {
  videoId: string;
  filePath: string;
  videoDuration: number;
  transcript: TranscriptSegment[];
  clips: VideoClip[];
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ProcessingJob {
  jobId: string;
  status: "uploading" | "transcribing" | "analyzing" | "clipping" | "done" | "error";
  progress: number;
  message: string;
  result?: AnalysisResult;
  error?: string;
}
