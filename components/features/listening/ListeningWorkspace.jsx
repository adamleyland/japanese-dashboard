"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import ListeningSourceToggle from "@/components/features/listening/ListeningSourceToggle";
import AudiobookWorkspace from "@/components/features/listening/audiobooks/AudiobookWorkspace";

export default function ListeningWorkspace({
  styles,
  isCompact,
  workspaceSource,
  setWorkspaceSource,
  onAudiobookPlaybackStateChange,
  focusMode,
  setFocusMode,
  isMounted,
  youtubeConnected,
  subscribedChannels,
  approvedFeed,
  discoverVideos,
  discoverFilter,
  setDiscoverFilter,
  discoverLoading,
  selectedVideo,
  selectedChannelAvatar,
  showDiscoverSubscribe,
  queueTotal,
  queueIndex,
  skipCurrentVideo,
  workspaceTab,
  setWorkspaceTab,
  onToggleYoutubeConnection,
  onTogglePlayback,
  isPlayerPlaying,
  onSelectVideo,
  onSelectDiscoverVideo,
  onOpenSelectedDiscoverChannel,
  onToggleChannelEnabled,
  playerHostRef,
  focusPlayerHostRef,
}) {
  const [channelSearch, setChannelSearch] = useState("");
  const isAudiobookMode = workspaceSource === "audiobooks";

  const panelItems = [
    { key: "account", label: "Account" },
    { key: "channels", label: "Channels" },
    { key: "recommended", label: "Queue" },
    { key: "discover", label: "Discover" },
  ];
  const discoverFilters = ["ã‚²ãƒ¼ãƒ ", "æ—…è¡Œ", "æ—¥æœ¬èªž"];
  const visibleQueueIndex = queueTotal ? queueIndex + 1 : 0;

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
    flexWrap: "wrap",
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
    padding: "7px 12px",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
    background: enabled ? "rgba(34,197,94,0.14)" : "var(--app-surface-soft)",
    color: enabled ? "#22c55e" : "var(--app-text-muted)",
  });

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
    <div style={styles.playerControlRow}>
      <button style={styles.miniActionButton("blue")} onClick={onTogglePlayback}>
        {isPlayerPlaying ? <PauseCircle size={12} /> : <PlayCircle size={12} />}
        {isPlayerPlaying ? "Pause" : "Play"}
      </button>
      <button style={styles.miniActionButton("orange")} onClick={skipCurrentVideo}>
        <SkipForward size={12} /> Skip
      </button>
      <button style={styles.miniActionButton("grey")} onClick={() => setFocusMode(!focusMode)}>
        <LampDesk size={12} />
        {focusMode ? "Exit Focus" : "Deep Focus"}
      </button>
      {showDiscoverSubscribe && (
        <button style={styles.miniActionButton("blue")} onClick={onOpenSelectedDiscoverChannel}>
          <Link2 size={12} /> Subscribe
        </button>
      )}
    </div>
  );

  return (
    <>
      <div style={styles.largeCard}>
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
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <h2
              style={{
                ...styles.sectionTitle,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              リスニング·ワークスペース
            </h2>
          </div>

          <ListeningSourceToggle
            value={workspaceSource}
            onChange={setWorkspaceSource}
            isCompact={isCompact}
          />
        </div>

        {isAudiobookMode ? (
          <AudiobookWorkspace onPlaybackStateChange={onAudiobookPlaybackStateChange} />
        ) : (
          <>
            {!focusMode && (
              <div style={styles.playerShell}>
                <div style={styles.playerFrameWrap}>
                  <div ref={playerHostRef} style={styles.playerFrame} />
                  <button style={styles.focusModeBtn} onClick={() => setFocusMode(true)}>
                    <Maximize2 size={14} />
                  </button>
                </div>

                <div style={styles.playerControlColumn}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      minWidth: 0,
                    }}
                  >
                    {renderPlayerAvatar(40)}
                    <div style={{ ...styles.playerMeta, minWidth: 0 }}>
                      <h3 style={styles.playerTitle}>{selectedVideo?.title || "Listening Queue"}</h3>
                      <p style={styles.playerSub}>
                        {selectedVideo?.channel || "YouTube"} | Queue {visibleQueueIndex}/{queueTotal || 0}
                      </p>
                    </div>
                  </div>

                  {renderPlayerControls()}
                </div>
              </div>
            )}

            {!focusMode && (
              <div style={styles.innerTabsWrap}>
                <div style={segmentedTrackStyle}>
                  {panelItems.map((item) => (
                    <button
                      key={item.key}
                      style={segmentedButtonStyle(workspaceTab === item.key)}
                      onClick={() =>
                        setWorkspaceTab((currentTab) => (currentTab === item.key ? null : item.key))
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

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
                            <p style={{ ...styles.playerSub, margin: 0 }}>
                              {youtubeConnected
                                ? "Click the green button to disconnect your account."
                                : "Click the icon to connect your account with Google OAuth."}
                            </p>
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
                                      .join(" Â· ") || channel.category}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                style={toggleButtonStyle(channel.enabled !== false)}
                                onClick={() => onToggleChannelEnabled(channel.channelId || channel.id)}
                              >
                                {channel.enabled !== false ? "ON" : "OFF"}
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

      {isMounted &&
        !isAudiobookMode &&
        focusMode &&
        createPortal(
          <div style={styles.focusOverlay}>
            <div style={styles.focusBackdrop} onClick={() => setFocusMode(false)} />

            <div style={styles.focusContent}>
              <div style={styles.playerShellFocus}>
                <div style={styles.playerFrameWrapFocus}>
                  <div ref={focusPlayerHostRef} style={styles.playerFrame} />
                  <button style={styles.focusModeBtn} onClick={() => setFocusMode(false)}>
                    <Minimize2 size={14} />
                  </button>
                </div>

                <div style={styles.playerControlRowFocus}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      minWidth: 0,
                    }}
                  >
                    {renderPlayerAvatar(36)}
                    <div style={{ ...styles.playerMeta, minWidth: 0 }}>
                      <h3 style={styles.playerTitleFocus}>
                        {selectedVideo?.title || "Listening Queue"}
                      </h3>
                      <p style={styles.playerSub}>
                        {selectedVideo?.channel || "YouTube"} | Queue {visibleQueueIndex}/{queueTotal || 0}
                      </p>
                    </div>
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
