"use client";

import { createPortal } from "react-dom";
import {
  Video,
  Link2,
  UserCircle2,
  PlayCircle,
  Maximize2,
  Minimize2,
  Save,
  SkipForward,
} from "lucide-react";
import { Tag } from "@/components/dashboard/DictionaryCarousel";

export default function ListeningWorkspace({
  styles,
  isMobile,
  isCompact,
  focusMode,
  setFocusMode,
  isMounted,
  youtubeConnected,
  setYoutubeConnected,
  subscribedChannels,
  approvedFeed,
  selectedVideo,
  selectedVideoId,
  setSelectedVideoId,
  queueTotal,
  queueIndex,
  saveCurrentSession,
  skipCurrentVideo,
  workspaceTab,
  setWorkspaceTab,
  onToggleYoutubeConnection,
  playerHostRef,
}) {
  return (
    <>
      <div style={styles.largeCard}>
        <div
          style={{
            ...styles.sectionHeader,
            flexDirection: isCompact ? "column" : "row",
          }}
        >
          <div>
            <h2 style={styles.sectionTitle}>Listening Workspace</h2>
            <p style={styles.sectionText}>Approved-channel feed and immersion architecture.</p>
          </div>
        </div>

        {!focusMode && (
          <div style={styles.playerShell}>
            <div style={styles.playerHeader}>
              <div style={styles.playerHeaderLeft}>
                <Video size={18} color="#ef4444" />
                <span style={styles.playerPlatform}>YouTube Integration</span>
              </div>
              <Tag
                label={youtubeConnected ? "Connected" : "Not Connected"}
                tone={youtubeConnected ? "green" : "orange"}
              />
            </div>

            <div style={styles.playerFrameWrap}>
              <div ref={playerHostRef} style={styles.playerFrame} />
              <button style={styles.focusModeBtn} onClick={() => setFocusMode(true)}>
                <Maximize2 size={14} />
              </button>
            </div>

            <div style={styles.playerControlColumn}>
              <div style={styles.playerMeta}>
                <h3 style={styles.playerTitle}>{selectedVideo?.title}</h3>
                <p style={styles.playerSub}>
                  {selectedVideo?.channel} · {selectedVideo?.duration} · Queue {queueIndex + 1}/
                  {queueTotal}
                </p>
              </div>
              <div style={styles.playerControlRow}>
                <button style={styles.miniActionButton("blue")} onClick={saveCurrentSession}>
                  <Save size={12} /> Save
                </button>
                <button style={styles.miniActionButton("orange")} onClick={skipCurrentVideo}>
                  <SkipForward size={12} /> Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {!focusMode && (
          <div style={styles.innerTabsWrap}>
            <div style={styles.innerTabsRow}>
              {[
                { key: "account", label: "Account" },
                { key: "channels", label: "Subscribed Channels" },
                { key: "recommended", label: "Recommended" },
              ].map((item) => (
                <button
                  key={item.key}
                  style={styles.innerTabButton(workspaceTab === item.key)}
                  onClick={() => setWorkspaceTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div style={styles.innerTabPanel}>
              {workspaceTab === "account" && (
                <>
                  <div style={styles.accountIdentity}>
                    <UserCircle2 size={18} />
                    <span>
                      {youtubeConnected
                        ? "Connected learner account"
                        : "Sign in to connect YouTube"}
                    </span>
                  </div>
                  <button
                    style={styles.connectButton(youtubeConnected)}
                    onClick={() => onToggleYoutubeConnection()}
                  >
                    <Link2 size={14} /> {youtubeConnected ? "Disconnect" : "Connect"}
                  </button>
                </>
              )}

              {workspaceTab === "channels" && (
                <div style={styles.listStack}>
                  {subscribedChannels.map((channel) => (
                    <div key={channel.id} style={styles.simpleRow}>
                      <span style={styles.simpleTitle}>{channel.name}</span>
                      <Tag label={channel.category} tone="blue" />
                    </div>
                  ))}
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
                        onClick={() => setSelectedVideoId(video.id)}
                      >
                        <div style={styles.videoFeedTop}>
                          <PlayCircle size={16} color={active ? "#ffffff" : "#64748b"} />
                          <span style={styles.videoFeedTitle(active)}>{video.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isMounted &&
        focusMode &&
        createPortal(
          <div style={styles.focusOverlay}>
            <div style={styles.focusBackdrop} onClick={() => setFocusMode(false)} />

            <div style={styles.focusContent}>
              <div style={styles.playerShellFocus}>
                <div style={styles.playerFrameWrapFocus}>
                  <div ref={playerHostRef} style={styles.playerFrame} />
                  <button style={styles.focusModeBtn} onClick={() => setFocusMode(false)}>
                    <Minimize2 size={14} />
                  </button>
                </div>

                <div style={styles.playerControlRowFocus}>
                  <div style={styles.playerMeta}>
                    <h3 style={styles.playerTitleFocus}>{selectedVideo?.title}</h3>
                    <p style={styles.playerSub}>
                      {selectedVideo?.channel} · {selectedVideo?.duration} · Queue {queueIndex + 1}/
                      {queueTotal}
                    </p>
                  </div>

                  <div style={styles.playerControlRow}>
                    <button style={styles.miniActionButton("blue")} onClick={saveCurrentSession}>
                      <Save size={12} /> Save
                    </button>
                    <button style={styles.miniActionButton("orange")} onClick={skipCurrentVideo}>
                      <SkipForward size={12} /> Skip
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
