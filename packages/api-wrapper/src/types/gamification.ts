import type { StringNullable, UnknownRecord } from "./common.js";

/** Wallet fields used by the ClassHero cosmetics store. */
export interface GamificationWallet extends UnknownRecord {
    xp_total: number;
    xp_spent?: number;
    xp_spent_total?: number;
    xp_available: number;
    current_level: number;
    last_purchase_at: StringNullable;
}

/** Purchase result captured successfully in the fifth HAR. */
export interface GamificationPurchaseResponse
    extends GamificationWallet {
    item_id: string;
    item_key: string;
    price_xp: number;
    slot_key: string;
    ledger_id: string;
    purchase_id: string;
    ownership_id: string;
    purchased_at: string;
    student_email: string;
}

/** Equip operation used by the current cosmetics frontend. */
export interface GamificationEquipInput {
    item_id: string;
    slot_key: string;
}

/** Unequip operation used by the current cosmetics frontend. */
export interface GamificationUnequipInput {
    slot_key: string;
}
