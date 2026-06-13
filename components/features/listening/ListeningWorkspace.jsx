"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  UserCircle2,
  Link2,
  PlayCircle,
  PauseCircle,
  Maximize2,
  Minimize2,
  SkipForward,
  Power,
  Search,
  LampDesk,
  ListVideo,
  ToggleLeft,
  ToggleRight,
  Ear,
  Heart,
  RefreshCcw,
} from "lucide-react";
import { PillSliderToggle } from "@/components/dashboard/DictionaryCarousel";
import ListeningSourceToggle from "@/components/features/listening/ListeningSourceToggle";
import AudiobookWorkspace from "@/components/features/listening/audiobooks/AudiobookWorkspace";

export default function ListeningWorkspace({
  styles,
  isMobile,
  isCompact,
  workspaceSource,
  setWorkspaceSource,
  authUserId,
  onAudiobookPlaybackStateChange,
  focusMode,
  setFocusMode,
  youtubeConnected,
  youtubeStatusMessage,
  subscribedChannels,
  approvedFeed,
  discoverVideos,
  discoverFilter,
  setDiscoverFilter,
  discoverLoading,
  selectedVideo,
  selectedChannelAvatar,
  isSelectedVideoPreferred = false,
  onToggleSelectedVideoPreference,
  queueTotal,
  queueIndex,
  forceReconnectYoutube,
  resetYoutubeState,
  skipCurrentVideo,
  onRefreshQueue,
  workspaceTab,
  setWorkspaceTab,
  youtubeVideoProgress = 0,
  onToggleYoutubeConnection,
  onTogglePlayback,
  isPlayerPlaying,
  onSelectVideo,
  onSelectDiscoverVideo,
  onToggleChannelEnabled,
  playerHostRef,
  focusPlayerHostRef,
  audiobooksData,
  audiobooksLoading,
  audiobooksError,
  audiobookLaunchRequest,
  onAudiobookLaunchResult,
}) {
  const [channelSearch, setChannelSearch] = useState("");
  const hasMounted = useSyncExternalStore(
    subscribeToMountState,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  const isLandscapeOrientation = useSyncExternalStore(
    subscribeToLandscapeOrientation,
    getLandscapeOrientationSnapshot,
    getServerLandscapeOrientationSnapshot,
  );
  const isAudiobookMode = workspaceSource === "audiobooks";
  const useInlineMobileFocusPlayer = isMobile && !isAudiobookMode;
  const showMobileLandscapeFocusOverlay =
    useInlineMobileFocusPlayer && focusMode && isLandscapeOrientation;

  const panelItems = [
    { key: "account", label: "Account", icon: UserCircle2 },
    { key: "channels", label: "Channels", icon: Search },
    { key: "recommended", label: "Queue", icon: ListVideo },
  ];
  const discoverFilters = ["ゲーム", "æ—…è¡Œ", "æ—¥æœ¬èªž"];
  const visibleQueueIndex = queueTotal ? queueIndex + 1 : 0;
  const clampedYoutubeVideoProgress = Math.max(
    0,
    Math.min(1, Number(youtubeVideoProgress) || 0),
  );

  const visibleChannels = useMemo(() => {
    const normalizedQuery = channelSearch.trim().toLowerCase();
    if (!normalizedQuery) return subscribedChannels;

    return subscribedChannels.filter((channel) => {
      const haystack = `${channel.name} ${channel.handle || ""} ${channel.category || ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [channelSearch, subscribedChannels]);

  const segmentedTrackStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px",
    borderRadius: "999px",
    background: "var(--app-pill-track)",
    border: "1px solid var(--app-border-soft)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    flexWrap: isMobile ? "nowrap" : "wrap",
    width: isMobile ? "100%" : "auto",
    boxSizing: "border-box",
  };

  const segmentedButtonStyle = (active) => ({
    border: "none",
    background: active ? "var(--app-selected-surface)" : "transparent",
    color: active ? "var(--app-selected-text)" : "var(--app-text-muted)",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 160ms ease",
    boxShadow: active ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  });

  const accountCardStyle = {
    display: "grid",
    gap: "14px",
    padding: "14px",
    borderRadius: "16px",
    background: "var(--app-card)",
    border: "1px solid var(--app-border-soft)",
  };

  const authIconButtonStyle = {
    width: "46px",
    height: "46px",
    borderRadius: "999px",
    border: youtubeConnected
      ? "1px solid rgba(34,197,94,0.18)"
      : "1px solid var(--app-border-soft)",
    background: youtubeConnected ? "rgba(34,197,94,0.12)" : "var(--app-surface-elevated)",
    color: youtubeConnected ? "#22c55e" : "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
  };

  const channelListStyle = {
    display: "grid",
    gap: "8px",
    maxHeight: "304px",
    overflowY: "auto",
    paddingRight: "4px",
    overscrollBehavior: "contain",
  };

  const toggleButtonStyle = (enabled) => ({
    border: "none",
    borderRadius: "999px",
    padding: isMobile ? "7px" : "7px 12px",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    background: enabled ? "rgba(34,197,94,0.14)" : "var(--app-surface-soft)",
    color: enabled ? "#22c55e" : "var(--app-text-muted)",
    minWidth: isMobile ? "32px" : "auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  });

  const preferredVideoButtonStyle = {
    width: isMobile ? "38px" : "36px",
    height: isMobile ? "38px" : "36px",
    borderRadius: "999px",
    border: isSelectedVideoPreferred
      ? "1px solid rgba(244, 63, 94, 0.28)"
      : "1px solid var(--app-border-soft)",
    background: isSelectedVideoPreferred
      ? "rgba(244, 63, 94, 0.14)"
      : "var(--app-surface-elevated)",
    color: isSelectedVideoPreferred ? "#f43f5e" : "var(--app-text-muted)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: selectedVideo?.id ? "pointer" : "default",
    flexShrink: 0,
    boxShadow: isSelectedVideoPreferred
      ? "0 8px 18px rgba(244, 63, 94, 0.12)"
      : "0 8px 18px rgba(15,23,42,0.04)",
  };

  const discoverFilterButtonStyle = (active) => ({
    border: "none",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    background: active ? "var(--app-selected-surface)" : "var(--app-surface-elevated)",
    color: active ? "var(--app-selected-text)" : "var(--app-text-soft)",
  });

  const renderAvatar = (channel) => {
    if (channel.thumbnail) {
      return (
        <img
          src={channel.thumbnail}
          alt={channel.name}
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "999px",
            objectFit: "cover",
            border: "1px solid var(--app-border-soft)",
          }}
        />
      );
    }

    return (
      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--app-surface-soft)",
          color: "var(--app-text-soft)",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {channel.name?.slice(0, 1)?.toUpperCase() || "Y"}
      </div>
    );
  };

  const formatSubscribers = (subscriberCount) => {
    if (!subscriberCount) return "";
    const value = Number(subscriberCount);
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M subs`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K subs`;
    return `${value} subs`;
  };

  const renderPlayerAvatar = (size = 40) => {
    if (selectedChannelAvatar) {
      return (
        <img
          src={selectedChannelAvatar}
          alt={selectedVideo?.channel || "Channel avatar"}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: "999px",
            objectFit: "cover",
            border: "1px solid var(--app-border-soft)",
            flexShrink: 0,
          }}
        />
      );
    }

    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--app-surface-soft)",
          color: "var(--app-text-soft)",
          fontSize: size <= 36 ? "12px" : "13px",
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {selectedVideo?.channel?.slice(0, 1)?.toUpperCase() || "Y"}
      </div>
    );
  };

  const renderPlayerControls = () => (
    <div
      style={{
        ...styles.playerControlRow,
        flexWrap: "nowrap",
        alignItems: "center",
        gap: isMobile ? "10px" : styles.playerControlRow.gap,
        minWidth: 0,
      }}
    >
      <button
        type="button"
        style={{
          ...styles.miniActionButton("blue"),
          minWidth: isMobile ? "56px" : "auto",
          minHeight: isMobile ? "52px" : undefined,
          justifyContent: "center",
          padding: isMobile ? "0 16px" : styles.miniActionButton("blue").padding,
          borderRadius: isMobile ? "14px" : styles.miniActionButton("blue").borderRadius,
          flex: isMobile ? "1 1 0" : "0 0 auto",
        }}
        onClick={onTogglePlayback}
        aria-label={isPlayerPlaying ? "Pause video" : "Play video"}
        title={isPlayerPlaying ? "Pause video" : "Play video"}
      >
        {isPlayerPlaying ? <PauseCircle size={isMobile ? 18 : 12} /> : <PlayCircle size={isMobile ? 18 : 12} />}
        {!isMobile ? (isPlayerPlaying ? "Pause" : "Play") : null}
      </button>
      <button
        type="button"
        style={{
          ...styles.miniActionButton("orange"),
          minWidth: isMobile ? "56px" : "auto",
          minHeight: isMobile ? "52px" : undefined,
          justifyContent: "center",
          padding: isMobile ? "0 16px" : styles.miniActionButton("orange").padding,
          borderRadius: isMobile ? "14px" : styles.miniActionButton("orange").borderRadius,
          flex: isMobile ? "1 1 0" : "0 0 auto",
        }}
        onClick={skipCurrentVideo}
        aria-label="Skip current video"
        title="Skip current video"
      >
        <SkipForward size={isMobile ? 18 : 12} />
        {!isMobile ? "Skip" : null}
      </button>
      <button
        type="button"
        style={{
          ...styles.miniActionButton("grey"),
          minWidth: isMobile ? "56px" : "auto",
          minHeight: isMobile ? "52px" : undefined,
          justifyContent: "center",
          padding: isMobile ? "0 16px" : styles.miniActionButton("grey").padding,
          borderRadius: isMobile ? "14px" : styles.miniActionButton("grey").borderRadius,
          flex: isMobile ? "1 1 0" : "0 0 auto",
        }}
        onClick={() => setFocusMode(!focusMode)}
        aria-label={focusMode ? "Exit focus mode" : "Enable focus mode"}
        title={focusMode ? "Exit focus mode" : "Enable focus mode"}
      >
        <LampDesk size={isMobile ? 18 : 12} />
        {!isMobile ? (focusMode ? "Exit Focus" : "Deep Focus") : null}
      </button>
      <button
        type="button"
        style={{
          ...styles.miniActionButton("grey"),
          minWidth: isMobile ? "56px" : "auto",
          minHeight: isMobile ? "52px" : undefined,
          justifyContent: "center",
          padding: isMobile ? "0 16px" : styles.miniActionButton("grey").padding,
          borderRadius: isMobile ? "14px" : styles.miniActionButton("grey").borderRadius,
          flex: isMobile ? "1 1 0" : "0 0 auto",
        }}
        onClick={onRefreshQueue}
        aria-label="Refresh queue"
        title="Refresh queue"
      >
        <RefreshCcw size={isMobile ? 18 : 12} />
        {!isMobile ? "Refresh queue" : null}
      </button>
    </div>
  );

  const mobileFocusAvailableHeight = "calc(100svh - 132px)";
  const mobileLandscapeFocusAvailableHeight = "calc(100svh - 20px)";
  const mobileLandscapeFocusFrameMaxWidth = "calc((100svh - 20px) * 1.7777778)";
  const focusContentStyle = isMobile
    ? {
        ...styles.focusContent,
        padding: "10px",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }
    : styles.focusContent;
  const focusShellStyle = isMobile
    ? showMobileLandscapeFocusOverlay
      ? {
          ...styles.playerShellFocus,
          width: "100%",
          maxWidth: "100%",
          height: "100%",
          maxHeight: "100%",
          padding: "10px",
          gap: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }
      : {
          ...styles.playerShellFocus,
          width: "100%",
          maxWidth: "100%",
          maxHeight: "calc(100svh - 20px)",
          padding: "10px",
          gap: "10px",
          overflow: "hidden",
          alignContent: "start",
        }
    : styles.playerShellFocus;
  const focusFrameWrapStyle = isMobile
    ? showMobileLandscapeFocusOverlay
      ? {
          ...styles.playerFrameWrapFocus,
          width: "100%",
          height: "auto",
          maxWidth: mobileLandscapeFocusFrameMaxWidth,
          maxHeight: mobileLandscapeFocusAvailableHeight,
          paddingTop: 0,
          aspectRatio: "16 / 9",
          margin: "0 auto",
          borderRadius: "18px",
          border: "1px solid rgba(148,163,184,0.22)",
          boxShadow: "0 24px 60px rgba(2, 6, 23, 0.42)",
          flexShrink: 0,
        }
      : {
          ...styles.playerFrameWrapFocus,
          width: "min(100%, calc(100svh * 1.3))",
          height: `min(${mobileFocusAvailableHeight}, 56.25vw)`,
          maxHeight: mobileFocusAvailableHeight,
          paddingTop: 0,
          aspectRatio: "16 / 9",
          margin: "0 auto",
          borderRadius: "16px",
          border: "1px solid rgba(15,23,42,0.12)",
          flexShrink: 0,
        }
    : styles.playerFrameWrapFocus;
  const focusControlRowStyle = showMobileLandscapeFocusOverlay
    ? { display: "none" }
    : isMobile
      ? {
          ...styles.playerControlRowFocus,
          display: "grid",
          gap: "10px",
          padding: "2px 0 0 0",
        }
    : styles.playerControlRowFocus;
  const focusMetaRowStyle = isMobile
    ? {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        minWidth: 0,
      }
    : {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        minWidth: 0,
      };
  const focusModeButtonStyle = isMobile
    ? {
        ...styles.focusModeBtn,
        width: "42px",
        height: "42px",
        top: "10px",
        right: "10px",
        borderRadius: "12px",
      }
    : styles.focusModeBtn;
  const inlinePlayerShellStyle = styles.playerShell;
  const inlinePlayerFrameWrapStyle =
    useInlineMobileFocusPlayer && focusMode ? focusFrameWrapStyle : styles.playerFrameWrap;
  const inlinePlayerMetaTitleStyle =
    useInlineMobileFocusPlayer && focusMode ? styles.playerTitleFocus : styles.playerTitle;
  const inlinePlayerMetaWrapStyle =
    useInlineMobileFocusPlayer && focusMode
      ? focusMetaRowStyle
      : {
          display: "flex",
          alignItems: "center",
          gap: "12px",
          minWidth: 0,
        };
  const inlinePlayerControlsWrapStyle =
    useInlineMobileFocusPlayer && focusMode
      ? focusControlRowStyle
      : styles.playerControlColumn;
  const InlinePlayerCloseIcon = useInlineMobileFocusPlayer && focusMode ? Minimize2 : Maximize2;
  const inlinePlayerCloseAction = () => setFocusMode((currentValue) => !currentValue);
  const overlayButtonBaseStyle = {
    width: "52px",
    height: "52px",
    borderRadius: "16px",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow: "0 12px 28px rgba(2, 6, 23, 0.22)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    touchAction: "manipulation",
  };
  const mobileFocusOverlayButtonStyle = (tone) => ({
    ...styles.miniActionButton(tone),
    ...overlayButtonBaseStyle,
    background:
      tone === "blue"
        ? "rgba(59,130,246,0.32)"
        : tone === "orange"
        ? "rgba(249,115,22,0.34)"
        : "rgba(15, 23, 42, 0.34)",
    color: "var(--app-selected-text)",
    border:
      tone === "grey"
        ? "1px solid rgba(226, 232, 240, 0.18)"
        : "1px solid rgba(255,255,255,0.16)",
  });
  const mobileFocusOverlayExitButtonStyle = {
    ...mobileFocusOverlayButtonStyle("grey"),
    borderRadius: "16px",
  };
  const renderMobileLandscapeFocusControls = () => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 12,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "14px",
          left: "14px",
          right: "92px",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <div
          style={{
            ...styles.playerProgressTrack,
            height: "5px",
            background: "rgba(15, 23, 42, 0.45)",
            boxShadow: "0 8px 24px rgba(2, 6, 23, 0.16)",
          }}
        >
          <div style={styles.playerProgressFill(clampedYoutubeVideoProgress)} />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "12px",
          transform: "translateY(-50%)",
          display: "grid",
          gap: "10px",
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          style={mobileFocusOverlayExitButtonStyle}
          onClick={() => setFocusMode(false)}
          aria-label="Exit deep focus"
          title="Exit deep focus"
        >
          <Minimize2 size={20} />
        </button>

        <button
          type="button"
          style={mobileFocusOverlayButtonStyle("blue")}
          onClick={onTogglePlayback}
          aria-label={isPlayerPlaying ? "Pause video" : "Play video"}
          title={isPlayerPlaying ? "Pause video" : "Play video"}
        >
          {isPlayerPlaying ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
        </button>

        <button
          type="button"
          style={mobileFocusOverlayButtonStyle("orange")}
          onClick={skipCurrentVideo}
          aria-label="Skip current video"
          title="Skip current video"
        >
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  );
  const renderPlayerShell = (shellStyle) => (
    <div style={shellStyle}>
      <div style={inlinePlayerFrameWrapStyle}>
        <div ref={playerHostRef} style={styles.playerFrame} />
        {showMobileLandscapeFocusOverlay ? (
          renderMobileLandscapeFocusControls()
        ) : (
          <button
            type="button"
            style={focusModeButtonStyle}
            onClick={inlinePlayerCloseAction}
          >
            <InlinePlayerCloseIcon size={isMobile ? 18 : 14} />
          </button>
        )}
      </div>

      {!showMobileLandscapeFocusOverlay ? (
        <div style={styles.playerProgressTrack} aria-hidden="true">
          <div style={styles.playerProgressFill(clampedYoutubeVideoProgress)} />
        </div>
      ) : null}

      <div style={inlinePlayerControlsWrapStyle}>
        <div style={inlinePlayerMetaWrapStyle}>
          {renderPlayerAvatar(40)}
          <div style={{ ...styles.playerMeta, minWidth: 0 }}>
            <h3 style={inlinePlayerMetaTitleStyle}>
              {selectedVideo?.title || "Listening Queue"}
            </h3>
            <p style={styles.playerSub}>
              {selectedVideo?.channel || "YouTube"} | Queue {visibleQueueIndex}/{queueTotal || 0}
            </p>
          </div>
          <button
            type="button"
            style={preferredVideoButtonStyle}
            onClick={onToggleSelectedVideoPreference}
            disabled={!selectedVideo?.id}
            aria-pressed={isSelectedVideoPreferred}
            aria-label={
              isSelectedVideoPreferred
                ? "Remove video preference"
                : "Prefer videos like this"
            }
            title={
              isSelectedVideoPreferred
                ? "Remove video preference"
                : "Prefer videos like this"
            }
          >
            <Heart size={isMobile ? 18 : 16} fill={isSelectedVideoPreferred ? "currentColor" : "none"} />
          </button>
        </div>

        {renderPlayerControls()}
      </div>
    </div>
  );
  return (
    <>
      <div
        style={{
          ...styles.largeCard,
          padding: isCompact ? "16px" : styles.largeCard.padding,
          border: isMobile ? "var(--listening-mobile-workspace-border)" : styles.largeCard.border,
          boxShadow: isMobile
            ? "var(--listening-mobile-workspace-shadow)"
            : styles.largeCard.boxShadow,
        }}
      >
        <div
          style={{
            ...styles.sectionHeader,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "nowrap",
            gap: "12px",
          }}
        >
          <div
            style={{
              minWidth: 0,
              flex: "1 1 auto",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "10px" : 0,
            }}
          >
            {isMobile ? (
              <div style={styles.progressContainer}>
                <div
                  style={{
                    ...styles.dictionaryIconFootprint,
                    background: "rgba(234, 179, 8, 0.16)",
                    border: "1px solid rgba(234, 179, 8, 0.18)",
                    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <Ear size={14} color="#facc15" strokeWidth={2.5} />
                </div>
              </div>
            ) : null}
            <h2
              style={{
                ...styles.sectionTitle,
                fontSize: isMobile ? "14px" : styles.sectionTitle.fontSize,
                letterSpacing: isMobile ? "-0.01em" : styles.sectionTitle.letterSpacing,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                margin: 0,
              }}
            >
              リスニング
            </h2>
          </div>

          <ListeningSourceToggle
            value={workspaceSource}
            onChange={setWorkspaceSource}
            isCompact={isCompact}
            isMobile={isMobile}
          />
        </div>

        <div
          key={isMobile ? workspaceSource : "desktop-listening-source"}
          className={
            isMobile
              ? `listening-source-panel listening-source-panel-${workspaceSource}`
              : undefined
          }
        >
          {isAudiobookMode ? (
          <AudiobookWorkspace
            authUserId={authUserId}
            onPlaybackStateChange={onAudiobookPlaybackStateChange}
            audiobooksData={audiobooksData}
            audiobooksLoading={audiobooksLoading}
            audiobooksError={audiobooksError}
            audiobookLaunchRequest={audiobookLaunchRequest}
            onAudiobookLaunchResult={onAudiobookLaunchResult}
            isMobile={isMobile}
          />
        ) : (
          <>
            {!focusMode && renderPlayerShell(inlinePlayerShellStyle)}

            {!focusMode && (
              <div style={styles.innerTabsWrap}>
                {isMobile ? (
                  <PillSliderToggle
                    value={workspaceTab}
                    onChange={(nextTab) =>
                      setWorkspaceTab((currentTab) => (currentTab === nextTab ? null : nextTab))
                    }
                    options={panelItems.map((item) => ({
                      value: item.key,
                      label: item.label,
                      icon: item.icon,
                      ariaLabel: item.label,
                    }))}
                    width="100%"
                    size="sm"
                    iconOnly
                    sliderBackground="var(--app-selected-surface)"
                    activeColor="var(--app-selected-text)"
                    inactiveColor="var(--app-text-muted)"
                    borderColor="var(--app-border-soft)"
                  />
                ) : (
                  <div style={segmentedTrackStyle}>
                    {panelItems.map((item) => (
                      <button
                        key={item.key}
                        style={segmentedButtonStyle(workspaceTab === item.key)}
                        onClick={() =>
                          setWorkspaceTab((currentTab) => (currentTab === item.key ? null : item.key))
                        }
                        aria-label={item.label}
                        title={item.label}
                      >
                        <item.icon size={15} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}

                {workspaceTab && (
                  <div
                    style={{
                      ...styles.innerTabPanel,
                      marginTop: "12px",
                    }}
                  >
                    {workspaceTab === "account" && (
                      <div style={accountCardStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <button
                            type="button"
                            aria-label={youtubeConnected ? "Disconnect YouTube" : "Connect YouTube"}
                            style={authIconButtonStyle}
                            onClick={onToggleYoutubeConnection}
                          >
                            {youtubeConnected ? <Power size={18} /> : <Link2 size={18} />}
                          </button>

                          <div style={{ display: "grid", gap: "3px" }}>
                            <div style={{ ...styles.simpleTitle, fontSize: "14px" }}>
                              {youtubeConnected ? "YouTube connected" : "YouTube disconnected"}
                            </div>
                          </div>
                        </div>

                        <div style={styles.accountIdentity}>
                          <UserCircle2 size={18} />
                          <span>
                            {youtubeConnected
                              ? "Your account-backed queue is ready."
                              : "Connect your account to unlock a daily shuffled listening queue."}
                          </span>
                        </div>

                        {!!youtubeStatusMessage && (
                          <div style={styles.playerSub}>{youtubeStatusMessage}</div>
                        )}

                        <div style={{ display: "grid", gap: "8px", justifyItems: "start" }}>
                          <button
                            type="button"
                            style={{
                              ...styles.miniActionButton("grey"),
                              justifySelf: "start",
                            }}
                            onClick={() => {
                              void (forceReconnectYoutube?.() || resetYoutubeState?.());
                            }}
                            aria-label="Force reconnect YouTube"
                            title="Force reconnect YouTube"
                          >
                            Force reconnect YouTube
                          </button>

                          <div style={styles.playerSub}>
                            Clears stale YouTube auth state first, then starts a fresh Google
                            connection.
                          </div>
                        </div>
                      </div>
                    )}

                    {workspaceTab === "channels" && (
                      <div style={{ display: "grid", gap: "10px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 12px",
                            borderRadius: "14px",
                            background: "var(--app-surface-elevated)",
                            border: "1px solid var(--app-border-soft)",
                          }}
                        >
                          <Search size={15} color="var(--app-text-muted)" />
                          <input
                            type="text"
                            value={channelSearch}
                            onChange={(event) => setChannelSearch(event.target.value)}
                            placeholder="Search channels"
                            style={{
                              flex: 1,
                              border: "none",
                              outline: "none",
                              background: "transparent",
                              fontSize: "13px",
                              color: "var(--app-text)",
                            }}
                          />
                        </div>

                        <div style={channelListStyle}>
                          {visibleChannels.map((channel) => (
                            <div
                              key={channel.channelId || channel.id}
                              style={{
                                ...styles.simpleRow,
                                gap: "12px",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "10px 12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  minWidth: 0,
                                }}
                              >
                                {renderAvatar(channel)}
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      ...styles.simpleTitle,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      maxWidth: "220px",
                                    }}
                                  >
                                    {channel.name}
                                  </div>
                                  <div style={styles.playerSub}>
                                    {[channel.handle, formatSubscribers(channel.subscriberCount)]
                                      .filter(Boolean)
                                      .join(" · ") || channel.category}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                style={toggleButtonStyle(channel.enabled !== false)}
                                onClick={() => onToggleChannelEnabled(channel.channelId || channel.id)}
                                aria-label={
                                  channel.enabled !== false
                                    ? `Disable ${channel.name}`
                                    : `Enable ${channel.name}`
                                }
                                title={
                                  channel.enabled !== false
                                    ? `Disable ${channel.name}`
                                    : `Enable ${channel.name}`
                                }
                              >
                                {isMobile ? (
                                  channel.enabled !== false ? (
                                    <ToggleRight size={16} />
                                  ) : (
                                    <ToggleLeft size={16} />
                                  )
                                ) : channel.enabled !== false ? (
                                  "ON"
                                ) : (
                                  "OFF"
                                )}
                              </button>
                            </div>
                          ))}

                          {!visibleChannels.length && (
                            <div style={{ ...styles.playerSub, padding: "8px 4px" }}>
                              No channels match your search.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {workspaceTab === "recommended" && (
                      <div style={styles.listStack}>
                        {approvedFeed.map((video) => {
                          const active = video.id === selectedVideo?.id;

                          return (
                            <button
                              key={video.id}
                              style={styles.videoFeedButton(active)}
                              onClick={() => onSelectVideo(video.id)}
                            >
                              <div style={styles.videoFeedTop}>
                                <PlayCircle
                                  size={16}
                                  color={active ? "var(--app-selected-text)" : "var(--app-text-muted)"}
                                />
                                <span style={styles.videoFeedTitle(active)}>{video.title}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {workspaceTab === "discover" && (
                      <div style={{ display: "grid", gap: "12px" }}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {discoverFilters.map((filter) => (
                            <button
                              key={filter}
                              type="button"
                              style={discoverFilterButtonStyle(discoverFilter === filter)}
                              onClick={() => setDiscoverFilter(filter)}
                            >
                              {filter}
                            </button>
                          ))}
                        </div>

                        {!youtubeConnected && (
                          <div style={{ ...styles.playerSub, padding: "8px 4px" }}>
                            Connect YouTube in the Account panel to load Discover videos.
                          </div>
                        )}

                        {youtubeConnected && (
                          <div style={{ ...channelListStyle, maxHeight: "332px" }}>
                            {discoverLoading && (
                              <div style={{ ...styles.playerSub, padding: "8px 4px" }}>
                                Loading discover videos...
                              </div>
                            )}

                            {!discoverLoading &&
                              discoverVideos.map((video) => {
                                const active = video.id === selectedVideo?.id;

                                return (
                                  <button
                                    key={video.id}
                                    type="button"
                                    onClick={() => onSelectDiscoverVideo(video.id)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      width: "100%",
                                      textAlign: "left",
                                      padding: "10px",
                                      borderRadius: "14px",
                                      border: active
                                        ? "1px solid var(--app-selected-border)"
                                        : "1px solid var(--app-border-soft)",
                                      background: active
                                        ? "var(--app-selected-surface)"
                                        : "var(--app-surface-elevated)",
                                      color: active ? "var(--app-selected-text)" : "var(--app-text)",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: "96px",
                                        aspectRatio: "16 / 9",
                                        borderRadius: "10px",
                                        overflow: "hidden",
                                        background: "var(--app-progress-track)",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {video.thumbnail ? (
                                        <img
                                          src={video.thumbnail}
                                          alt={video.title}
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                          }}
                                        />
                                      ) : null}
                                    </div>

                                    <div style={{ minWidth: 0, display: "grid", gap: "4px" }}>
                                      <div
                                        style={{
                                          fontSize: "13px",
                                          fontWeight: 700,
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {video.title}
                                      </div>
                                      <div
                                        style={{
                                          ...styles.playerSub,
                                          color: active
                                            ? "rgba(248, 250, 252, 0.78)"
                                            : "var(--app-text-muted)",
                                        }}
                                      >
                                        {video.channel}
                                        {video.duration ? ` Â· ${video.duration}` : ""}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}

                            {!discoverLoading && !discoverVideos.length && (
                              <div style={{ ...styles.playerSub, padding: "8px 4px" }}>
                                No discover videos found for this filter right now.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
          )}
        </div>
      </div>

      {hasMounted &&
        useInlineMobileFocusPlayer &&
        focusMode &&
        createPortal(
          <div style={styles.focusOverlay}>
            <div style={styles.focusBackdrop} onClick={() => setFocusMode(false)} />

            <div style={focusContentStyle}>{renderPlayerShell(focusShellStyle)}</div>
          </div>,
          document.body,
        )}

      {hasMounted &&
        !isAudiobookMode &&
        focusMode &&
        !isMobile &&
        createPortal(
          <div style={styles.focusOverlay}>
            <div style={styles.focusBackdrop} onClick={() => setFocusMode(false)} />

            <div style={focusContentStyle}>
              <div style={focusShellStyle}>
                <div style={focusFrameWrapStyle}>
                  <div ref={focusPlayerHostRef} style={styles.playerFrame} />
                  <button
                    type="button"
                    style={focusModeButtonStyle}
                    onClick={() => setFocusMode(false)}
                  >
                    <Minimize2 size={isMobile ? 18 : 14} />
                  </button>
                </div>

                <div style={styles.playerProgressTrack} aria-hidden="true">
                  <div style={styles.playerProgressFill(clampedYoutubeVideoProgress)} />
                </div>

                <div style={focusControlRowStyle}>
                  <div style={focusMetaRowStyle}>
                    {renderPlayerAvatar(36)}
                    <div style={{ ...styles.playerMeta, minWidth: 0 }}>
                      <h3 style={styles.playerTitleFocus}>
                        {selectedVideo?.title || "Listening Queue"}
                      </h3>
                      <p style={styles.playerSub}>
                        {selectedVideo?.channel || "YouTube"} | Queue {visibleQueueIndex}/{queueTotal || 0}
                      </p>
                    </div>
                    <button
                      type="button"
                      style={preferredVideoButtonStyle}
                      onClick={onToggleSelectedVideoPreference}
                      disabled={!selectedVideo?.id}
                      aria-pressed={isSelectedVideoPreferred}
                      aria-label={
                        isSelectedVideoPreferred
                          ? "Remove video preference"
                          : "Prefer videos like this"
                      }
                      title={
                        isSelectedVideoPreferred
                          ? "Remove video preference"
                          : "Prefer videos like this"
                      }
                    >
                      <Heart size={isMobile ? 18 : 16} fill={isSelectedVideoPreferred ? "currentColor" : "none"} />
                    </button>
                  </div>

                  {renderPlayerControls()}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function subscribeToMountState() {
  return () => {};
}

function getMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

function subscribeToLandscapeOrientation(callback) {
  if (typeof window === "undefined") return () => {};

  const mediaQuery = window.matchMedia?.("(orientation: landscape)");
  const notify = () => callback();

  if (mediaQuery) {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", notify);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(notify);
    }
  }

  window.addEventListener("resize", notify);
  window.addEventListener("orientationchange", notify);

  return () => {
    if (mediaQuery) {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", notify);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(notify);
      }
    }

    window.removeEventListener("resize", notify);
    window.removeEventListener("orientationchange", notify);
  };
}

function getLandscapeOrientationSnapshot() {
  if (typeof window === "undefined") return false;

  if (window.matchMedia?.("(orientation: landscape)")?.matches) {
    return true;
  }

  return window.innerWidth > window.innerHeight;
}

function getServerLandscapeOrientationSnapshot() {
  return false;
}

