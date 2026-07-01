    // src/components/RulesModal/RulesModal.jsx
    "use client";

    import { useState } from "react";
    import { X } from "lucide-react";
    import { RULES_CONTENT, FOULS_CONTENT, STATS_DEFINITIONS } from "@/lib/rulesContent";
    import styles from "./RulesModal.module.css";

    const MODE_TABS = ["5x5", "3x3", "1x1"];

    export default function RulesModal({ onClose }) {
    const [activeTab, setActiveTab] = useState("5x5");

    const mode = RULES_CONTENT[activeTab];

    return (
        <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
            <h2 className={styles.title}>Regras do jogo</h2>
            <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Fechar"
            >
                <X size={20} />
            </button>
            </div>

            <div className={styles.tabs}>
            {MODE_TABS.map((tab) => (
                <button
                key={tab}
                type="button"
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab)}
                >
                {RULES_CONTENT[tab].label}
                </button>
            ))}
            <button
                type="button"
                className={`${styles.tab} ${activeTab === "fouls" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("fouls")}
            >
                Faltas
            </button>
            <button
                type="button"
                className={`${styles.tab} ${activeTab === "stats" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("stats")}
            >
                Stats
            </button>
            </div>

            <div className={styles.content}>
            {activeTab === "stats" && (
                <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Como cada estatística é contada</h3>
                <ul className={styles.statsList}>
                    {STATS_DEFINITIONS.map((stat) => (
                    <li key={stat.key} className={styles.statItem}>
                        <span className={styles.statLabel}>{stat.label}</span>
                        <span className={styles.statDescription}>{stat.description}</span>
                    </li>
                    ))}
                </ul>
                </section>
            )}

            {activeTab === "fouls" && (
                <>
                <p className={styles.note}>
                    Regras oficiais da FIBA, válidas para os três modos de jogo (5x5, 3x3 e 1x1).
                </p>
                {Object.values(FOULS_CONTENT).map((block) => (
                    <section className={styles.section} key={block.title}>
                    <h3 className={styles.sectionTitle}>{block.title}</h3>
                    <ul className={styles.ruleList}>
                        {block.items.map((item, i) => (
                        <li key={i}>{item}</li>
                        ))}
                    </ul>
                    </section>
                ))}
                </>
            )}

            {activeTab !== "stats" && activeTab !== "fouls" && (
                <>
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>{mode.official.title}</h3>
                    {mode.official.note && (
                    <p className={styles.note}>{mode.official.note}</p>
                    )}
                    {mode.official.items.length > 0 && (
                    <ul className={styles.ruleList}>
                        {mode.official.items.map((item, i) => (
                        <li key={i}>{item}</li>
                        ))}
                    </ul>
                    )}
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                    <span className={styles.badge}>Casa</span>
                    {mode.house.title}
                    </h3>
                    <ul className={styles.ruleList}>
                    {mode.house.items.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                    </ul>
                </section>
                </>
            )}
            </div>
        </div>
        </div>
    );
    }