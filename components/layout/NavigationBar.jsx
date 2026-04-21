export default function NavigationBar({ activeTab, isMobile, onChange, moduleTabs, styles }) {
  return (
    <div
      style={{
        ...styles.moduleNavTrack,
        width: isMobile ? "100%" : styles.moduleNavTrack.width,
        gap: isMobile ? "6px" : styles.moduleNavTrack.gap,
        justifyContent: isMobile ? "space-between" : "flex-start",
      }}
    >
      {moduleTabs.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;

        return (
          <button
            type="button"
            key={item.key}
            onClick={() => onChange(item.key)}
            style={{
              ...styles.moduleNavButton(isActive),
              padding: isMobile ? "10px" : styles.moduleNavButton(isActive).padding,
              flex: isMobile ? "1 1 0" : "0 0 auto",
              minWidth: 0,
            }}
            aria-pressed={isActive}
            aria-label={item.label}
            title={item.label}
          >
            <Icon size={18} />
            {!isMobile && isActive && <span style={{ marginLeft: "6px" }}>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
