import { memo, type MutableRefObject, type RefObject } from "react";
import { LowMinutesWarning } from "@/app/components/modals/LowMinutesWarning";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";
import type { CompanionViewTuning } from "@/lib/avatar/companionViewTuning";
import type { EzriWsStatus } from "@/lib/ezri/realtimeClient";
import type { SessionBackdropLayers, SessionBackdropPreference } from "@/lib/sessionBackdropPresets";
import type { SafetyResource, SafetyState } from "@/app/types/safety";
import { CRISIS_KEYWORD_MODAL_ENABLED } from "../constants";
import type { LiveUserSpeechStore } from "../hooks/useLiveUserSpeechStore";
import type { TranscriptLine } from "../utils/transcript";
import type { FixedAvatarViewportConfig } from "./ThreeAvatar";
import { CrisisKeywordModal } from "./CrisisKeywordModal";
import { EndSessionConfirmModal } from "./EndSessionConfirmModal";
import { LowCreditsBanner } from "./LowCreditsBanner";
import { OutOfCreditsModal } from "./OutOfCreditsModal";
import { PermissionModal } from "./PermissionModal";
import { SafetyBoundaryBanner } from "./SafetyBoundaryBanner";
import { SafetyResourcesModal } from "./SafetyResourcesModal";
import { SessionControlDock } from "./SessionControlDock";
import { SessionEndingOverlay } from "./SessionEndingOverlay";
import { SessionLeftRail } from "./SessionLeftRail";
import { SessionRightRail, type MoodPreviewRow } from "./SessionRightRail";
import { SessionStage } from "./SessionStage";
import { UserCameraPip } from "./UserCameraPip";

export interface ActiveSessionViewProps {
  sessionContainerRef: RefObject<HTMLDivElement>;
  sessionViewportClass: string;
  sessionBackdropLayers: SessionBackdropLayers;
  isEndingSession: boolean;
  stageShellPadding: string;
  stageRoundClass: string;
  stageSidePanelInsetL: string;
  stageSidePanelInsetR: string;
  stageRailWidthLeftClass: string;
  stageRailWidthRightClass: string;
  stageBottomBar: string;
  isEzriSpeaking: boolean;
  sessionUsesCompanion3d: boolean;
  companionAvatarLabel: string | undefined;
  companionCanonicalId: string | null;
  companionModelUrl: string;
  companionViewTuning: CompanionViewTuning;
  companionFixedViewportConfig: FixedAvatarViewportConfig | null;
  sessionUsesRfv2Morphs: boolean;
  isListening: boolean;
  isEzriThinking: boolean;
  mouthAudioLevelRef: MutableRefObject<number>;
  avatarPhonemeTimelineRef: MutableRefObject<AvatarPhonemeTimeline | null>;
  avatarAudioCurrentTimeRef: MutableRefObject<number>;
  speechTextRef: MutableRefObject<string>;
  speechCharIndexRef: MutableRefObject<number>;
  speechPulseRef: MutableRefObject<number>;
  latestUserTextRef: MutableRefObject<string>;
  latestJordanTextRef: MutableRefObject<string>;
  userSpeechStartedAtMsRef: MutableRefObject<number>;
  userLastSpeechAtMsRef: MutableRefObject<number>;
  jordanSpeechStartedAtMsRef: MutableRefObject<number>;
  jordanLastSpeechAtMsRef: MutableRefObject<number>;
  sentimentCompoundRef: MutableRefObject<number | undefined>;
  companionPortraitUrl: string;
  leftSessionChromeRef: RefObject<HTMLDivElement>;
  sessionGreeting: string;
  viewerFirstName: string;
  transcriptListRef: RefObject<HTMLDivElement>;
  transcript: TranscriptLine[];
  liveUserSpeech: LiveUserSpeechStore;
  isMuted: boolean;
  companionName: string;
  sttProvider: string | undefined;
  ezriWsStatus: EzriWsStatus;
  ezriWarmupStatus: "idle" | "warming" | "ready";
  permissionsGranted: boolean;
  sessionStatsOpen: boolean;
  onToggleSessionStats: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  profileAvatarUrl: string | null | undefined;
  sessionTime: number;
  remainingSeconds: number | null;
  remainingWholeMinutes: number | null;
  connectionQuality: "excellent" | "good" | "poor";
  connectionQualityColor: string;
  sortedMoodPreview: MoodPreviewRow[];
  latestMoodEmoji: string;
  roomMoodPickerOpen: boolean;
  onRoomMoodPickerOpenChange: (open: boolean) => void;
  isSessionPaused: boolean;
  onToggleSessionPaused: () => void;
  selectedRoomMoodLabel: string;
  sessionBackdropPreference: SessionBackdropPreference;
  onSelectSessionBackdrop: (value: SessionBackdropPreference) => void;
  onToggleMuted: () => void;
  isCameraOff: boolean;
  onCameraToggle: () => void;
  isSoundOff: boolean;
  onToggleSoundOff: () => void;
  onShowEndConfirm: () => void;
  pipOpen: boolean;
  pipPos: { left: number; bottom: number };
  videoRef: RefObject<HTMLVideoElement>;
  onPipPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPipPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPipPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  showPermissionRequest: boolean;
  pendingMediaEntry: boolean;
  hasBrowserSpeechRecognition: boolean;
  onPermissionCancel: () => void;
  onAllowAccess: () => void;
  showLowCreditsWarning: boolean;
  projectedAccountRemainingWholeMinutes: number | null;
  projectedAccountRemainingSeconds: number | null;
  isBuyingMoreMinutes: boolean;
  onBuyMoreMinutes: () => void;
  onDismissLowCredits: () => void;
  showOutOfCredits: boolean;
  onOutOfCreditsBuyMore: () => void;
  onOutOfCreditsUpgrade: () => void;
  showLowMinutesModal: boolean;
  onCloseLowMinutesModal: () => void;
  showEndConfirm: boolean;
  isUploading: boolean;
  onCloseEndConfirm: () => void;
  onEndSession: () => void;
  showSafetyBoundary: boolean;
  onViewSafetyResources: () => void;
  onDismissSafetyBoundary: () => void;
  showCrisisKeywordModal: boolean;
  detectedCrisisKeywords: string[];
  crisisDialTarget: string | undefined;
  onCallEmergency: () => void;
  onCrisisViewSafetyResources: () => void;
  onDismissCrisisModal: () => void;
  showSafetyResources: boolean;
  safetyResources: SafetyResource[];
  sessionId: string | null;
  safetyState: SafetyState;
  onReturnToDashboard: () => void;
}

function ActiveSessionViewComponent(props: ActiveSessionViewProps) {
  const {
    sessionContainerRef,
    sessionViewportClass,
    sessionBackdropLayers,
    isEndingSession,
    stageShellPadding,
    stageRoundClass,
    stageSidePanelInsetL,
    stageSidePanelInsetR,
    stageRailWidthLeftClass,
    stageRailWidthRightClass,
    stageBottomBar,
    isEzriSpeaking,
    sessionUsesCompanion3d,
    companionAvatarLabel,
    companionCanonicalId,
    companionModelUrl,
    companionViewTuning,
    companionFixedViewportConfig,
    sessionUsesRfv2Morphs,
    isListening,
    isEzriThinking,
    mouthAudioLevelRef,
    avatarPhonemeTimelineRef,
    avatarAudioCurrentTimeRef,
    speechTextRef,
    speechCharIndexRef,
    speechPulseRef,
    latestUserTextRef,
    latestJordanTextRef,
    userSpeechStartedAtMsRef,
    userLastSpeechAtMsRef,
    jordanSpeechStartedAtMsRef,
    jordanLastSpeechAtMsRef,
    sentimentCompoundRef,
    companionPortraitUrl,
    leftSessionChromeRef,
    sessionGreeting,
    viewerFirstName,
    transcriptListRef,
    transcript,
    liveUserSpeech,
    isMuted,
    companionName,
    sttProvider,
    ezriWsStatus,
    ezriWarmupStatus,
    permissionsGranted,
    sessionStatsOpen,
    onToggleSessionStats,
    isFullscreen,
    onToggleFullscreen,
    profileAvatarUrl,
    sessionTime,
    remainingSeconds,
    remainingWholeMinutes,
    connectionQuality,
    connectionQualityColor,
    sortedMoodPreview,
    latestMoodEmoji,
    roomMoodPickerOpen,
    onRoomMoodPickerOpenChange,
    isSessionPaused,
    onToggleSessionPaused,
    selectedRoomMoodLabel,
    sessionBackdropPreference,
    onSelectSessionBackdrop,
    onToggleMuted,
    isCameraOff,
    onCameraToggle,
    isSoundOff,
    onToggleSoundOff,
    onShowEndConfirm,
    pipOpen,
    pipPos,
    videoRef,
    onPipPointerDown,
    onPipPointerMove,
    onPipPointerUp,
    showPermissionRequest,
    pendingMediaEntry,
    hasBrowserSpeechRecognition,
    onPermissionCancel,
    onAllowAccess,
    showLowCreditsWarning,
    projectedAccountRemainingWholeMinutes,
    projectedAccountRemainingSeconds,
    isBuyingMoreMinutes,
    onBuyMoreMinutes,
    onDismissLowCredits,
    showOutOfCredits,
    onOutOfCreditsBuyMore,
    onOutOfCreditsUpgrade,
    showLowMinutesModal,
    onCloseLowMinutesModal,
    showEndConfirm,
    isUploading,
    onCloseEndConfirm,
    onEndSession,
    showSafetyBoundary,
    onViewSafetyResources,
    onDismissSafetyBoundary,
    showCrisisKeywordModal,
    detectedCrisisKeywords,
    crisisDialTarget,
    onCallEmergency,
    onCrisisViewSafetyResources,
    onDismissCrisisModal,
    showSafetyResources,
    safetyResources,
    sessionId,
    safetyState,
    onReturnToDashboard,
  } = props;

  return (
    <div
      ref={sessionContainerRef}
      className={sessionViewportClass}
      style={{ backgroundColor: sessionBackdropLayers.rootBg }}
    >
      <SessionEndingOverlay open={isEndingSession} />

      <div className={`absolute inset-0 z-0 box-border ${stageShellPadding}`}>
        <div
          className={`relative h-full w-full overflow-hidden ${stageRoundClass}`}
        >
          <SessionStage
            stageRoundClass={stageRoundClass}
            sessionBackdropLayers={sessionBackdropLayers}
            isEzriSpeaking={isEzriSpeaking}
            sessionUsesCompanion3d={sessionUsesCompanion3d}
            companionAvatarLabel={companionAvatarLabel}
            companionCanonicalId={companionCanonicalId}
            companionModelUrl={companionModelUrl}
            companionViewTuning={companionViewTuning}
            companionFixedViewportConfig={companionFixedViewportConfig}
            sessionUsesRfv2Morphs={sessionUsesRfv2Morphs}
            isListening={isListening}
            isEzriThinking={isEzriThinking}
            mouthAudioLevelRef={mouthAudioLevelRef}
            avatarPhonemeTimelineRef={avatarPhonemeTimelineRef}
            avatarAudioCurrentTimeRef={avatarAudioCurrentTimeRef}
            speechTextRef={speechTextRef}
            speechCharIndexRef={speechCharIndexRef}
            speechPulseRef={speechPulseRef}
            latestUserTextRef={latestUserTextRef}
            latestJordanTextRef={latestJordanTextRef}
            userSpeechStartedAtMsRef={userSpeechStartedAtMsRef}
            userLastSpeechAtMsRef={userLastSpeechAtMsRef}
            jordanSpeechStartedAtMsRef={jordanSpeechStartedAtMsRef}
            jordanLastSpeechAtMsRef={jordanLastSpeechAtMsRef}
            sentimentCompoundRef={sentimentCompoundRef}
            companionPortraitUrl={companionPortraitUrl}
          />

          <SessionLeftRail
            stageSidePanelInsetL={stageSidePanelInsetL}
            stageRailWidthLeftClass={stageRailWidthLeftClass}
            leftSessionChromeRef={leftSessionChromeRef}
            sessionGreeting={sessionGreeting}
            viewerFirstName={viewerFirstName}
            transcriptListRef={transcriptListRef}
            transcript={transcript}
            liveUserSpeech={liveUserSpeech}
            isMuted={isMuted}
            isSessionPaused={isSessionPaused}
            isSoundOff={isSoundOff}
            isEzriSpeaking={isEzriSpeaking}
            isEzriThinking={isEzriThinking}
            companionName={companionName}
            sttProvider={sttProvider}
            ezriWsStatus={ezriWsStatus}
            ezriWarmupStatus={ezriWarmupStatus}
            permissionsGranted={permissionsGranted}
          />

          <SessionRightRail
            stageSidePanelInsetR={stageSidePanelInsetR}
            stageRailWidthRightClass={stageRailWidthRightClass}
            sessionStatsOpen={sessionStatsOpen}
            onToggleSessionStats={onToggleSessionStats}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            profileAvatarUrl={profileAvatarUrl}
            viewerFirstName={viewerFirstName}
            ezriWsStatus={ezriWsStatus}
            companionName={companionName}
            sessionTime={sessionTime}
            remainingSeconds={remainingSeconds}
            remainingWholeMinutes={remainingWholeMinutes}
            connectionQuality={connectionQuality}
            connectionQualityColor={connectionQualityColor}
            sortedMoodPreview={sortedMoodPreview}
            latestMoodEmoji={latestMoodEmoji}
          />

          <SessionControlDock
            stageBottomBar={stageBottomBar}
            roomMoodPickerOpen={roomMoodPickerOpen}
            onRoomMoodPickerOpenChange={onRoomMoodPickerOpenChange}
            isSessionPaused={isSessionPaused}
            onToggleSessionPaused={onToggleSessionPaused}
            selectedRoomMoodLabel={selectedRoomMoodLabel}
            sessionBackdropPreference={sessionBackdropPreference}
            onSelectSessionBackdrop={onSelectSessionBackdrop}
            isMuted={isMuted}
            onToggleMuted={onToggleMuted}
            isCameraOff={isCameraOff}
            onCameraToggle={onCameraToggle}
            isSoundOff={isSoundOff}
            onToggleSoundOff={onToggleSoundOff}
            onShowEndConfirm={onShowEndConfirm}
          />
        </div>
      </div>

      <UserCameraPip
        open={pipOpen}
        pipPos={pipPos}
        videoRef={videoRef}
        isCameraOff={isCameraOff}
        isMuted={isMuted}
        onPointerDown={onPipPointerDown}
        onPointerMove={onPipPointerMove}
        onPointerUp={onPipPointerUp}
      />

      <PermissionModal
        open={showPermissionRequest && !permissionsGranted}
        companionName={companionName}
        pendingMediaEntry={pendingMediaEntry}
        ezriWarmupStatus={ezriWarmupStatus}
        ezriWsStatus={ezriWsStatus}
        hasBrowserSpeechRecognition={hasBrowserSpeechRecognition}
        onCancel={onPermissionCancel}
        onAllowAccess={onAllowAccess}
      />

      <LowCreditsBanner
        open={
          showLowCreditsWarning &&
          projectedAccountRemainingWholeMinutes !== null &&
          projectedAccountRemainingWholeMinutes > 0 &&
          projectedAccountRemainingWholeMinutes < 10
        }
        projectedAccountRemainingSeconds={projectedAccountRemainingSeconds}
        isBuyingMoreMinutes={isBuyingMoreMinutes}
        onBuyMoreMinutes={onBuyMoreMinutes}
        onDismiss={onDismissLowCredits}
      />

      <OutOfCreditsModal
        open={showOutOfCredits}
        sessionTime={sessionTime}
        onBuyMoreMinutes={onOutOfCreditsBuyMore}
        onUpgradePlan={onOutOfCreditsUpgrade}
        onReturnToDashboard={onReturnToDashboard}
      />

      <LowMinutesWarning
        isOpen={showLowMinutesModal}
        onClose={onCloseLowMinutesModal}
        minutesRemaining={remainingWholeMinutes ?? 0}
      />

      <EndSessionConfirmModal
        open={showEndConfirm}
        companionName={companionName}
        sessionTime={sessionTime}
        isUploading={isUploading}
        onClose={onCloseEndConfirm}
        onEndSession={onEndSession}
      />

      <SafetyBoundaryBanner
        open={showSafetyBoundary}
        onViewResources={onViewSafetyResources}
        onDismiss={onDismissSafetyBoundary}
      />

      <CrisisKeywordModal
        open={CRISIS_KEYWORD_MODAL_ENABLED && showCrisisKeywordModal}
        detectedCrisisKeywords={detectedCrisisKeywords}
        crisisDialTarget={crisisDialTarget ?? null}
        onCallEmergency={onCallEmergency}
        onViewSafetyResources={onCrisisViewSafetyResources}
        onDismiss={onDismissCrisisModal}
      />

      <SafetyResourcesModal
        open={showSafetyResources}
        safetyResources={safetyResources}
        sessionId={sessionId}
        safetyState={safetyState}
        onReturnToDashboard={onReturnToDashboard}
      />
    </div>
  );
}

export const ActiveSessionView = memo(ActiveSessionViewComponent);
