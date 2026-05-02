export default function NavigationBar({ activeTab, isMobile, onChange, moduleTabs, styles }) {
  const visibleTabs = isMobile
    ? moduleTabs.filter((item) => item.key !== "shadowing")
    : moduleTabs;

  return (
    <div
      style={{
        ...styles.moduleNavTrack,
        width: isMobile ? "100%" : styles.moduleNavTrack.width,
        gap: isMobile ? "4px" : styles.moduleNavTrack.gap,
        justifyContent: isMobile ? "space-between" : "flex-start",
      }}
    >
      {visibleTabs.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;

        return (
          <button
            type="button"
            key={item.key}
            onClick={() => onChange(item.key)}
            style={{
              ...styles.moduleNavButton(isActive, isMobile),
              flex: isMobile ? "1 1 0" : "0 0 auto",
              minWidth: 0,
            }}
            aria-pressed={isActive}
            aria-label={item.label}
            title={item.label}
          >
            <Icon size={isMobile ? 20 : 18} />
            {!isMobile && isActive && <span style={{ marginLeft: "6px" }}>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
