/** Web entry — import pulse helpers directly (avoids loading the full @meetezri/shared barrel in the browser). */
export {
  scoreCommunityTextSentiment,
  sentimentSignalsFromTexts,
  computeCommunityPulsePercent,
  communityPulseHeadlineFromPercent,
  communityPulseDetailFromSignals,
  type CommunitySentimentScore,
  type CommunityPulseSignal,
  type CommunityPulseResult,
} from '../../../../packages/shared/src/communityPulse';
