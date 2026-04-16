export default function NavigationBar({ activeTab, onChange, moduleTabs, styles }) {
  return (
    <section style={styles.tabsWrap}>
      <div style={styles.moduleNavTrack}>
        {moduleTabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;

          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              style={styles.moduleNavButton(isActive)}
            >
              <Icon size={18} />
              {isActive && <span style={{ marginLeft: "6px" }}>{item.label}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
