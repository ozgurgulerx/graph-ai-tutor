export function ShortcutsHelp(props: { open: boolean; onClose: () => void }) {
  if (!props.open) return null;

  return (
    <div
      className="shortcutsHelpOverlay"
      data-testid="shortcuts-help-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="modalContent shortcutsHelpPanel">
        <div className="shortcutsHelpHeader">
          <h2>Keyboard Shortcuts</h2>
          <button type="button" className="ghostButton" onClick={props.onClose}>
            Close
          </button>
        </div>
        <ul className="shortcutsHelpList">
          <li><strong>n</strong> — New Note (selected concept required)</li>
          <li><strong>q</strong> — Generate Quiz (selected concept required)</li>
          <li><strong>e</strong> — Add Relation (selected concept required)</li>
          <li><strong>[</strong> — Toggle left pane</li>
          <li><strong>]</strong> — Toggle right pane</li>
          <li><strong>Esc</strong> — Close top modal/drawer, then clear graph selection</li>
          <li><strong>?</strong> — Open this help overlay</li>
          <li><strong>Ctrl/Cmd+K</strong> — Open command palette</li>
        </ul>
      </div>
    </div>
  );
}
