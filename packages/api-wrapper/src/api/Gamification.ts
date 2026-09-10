import { Api } from "../client/Api.js";
import type {
    GamificationEquipInput,
    GamificationPurchaseResponse,
    GamificationUnequipInput,
    GamificationWallet,
    UnknownRecord,
} from "../types/index.js";

/**
 * Student gamification/cosmetics endpoints.
 *
 * `/gamification/purchase` is newly observed in the fifth HAR. Shop, profile,
 * equip and unequip were already present in the route inventory and frontend.
 */
export class Gamification extends Api {
    shop() {
        return this.request<UnknownRecord>(
            "/gamification/shop",
        );
    }

    me() {
        return this.request<UnknownRecord>(
            "/gamification/me",
        );
    }

    wallet() {
        return this.request<GamificationWallet>(
            "/gamification/wallet",
        );
    }

    purchase(itemId: string) {
        return this.request<GamificationPurchaseResponse>(
            "/gamification/purchase",
            {
                method: "POST",
                body: JSON.stringify({
                    item_id:
                        itemId,
                }),
            },
        );
    }

    equip(input: GamificationEquipInput) {
        return this.request<UnknownRecord>(
            "/gamification/equip",
            {
                method: "POST",
                body: JSON.stringify(input),
            },
        );
    }

    unequip(input: GamificationUnequipInput) {
        return this.request<UnknownRecord>(
            "/gamification/unequip",
            {
                method: "POST",
                body: JSON.stringify(input),
            },
        );
    }
}
