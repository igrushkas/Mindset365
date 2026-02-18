<?php

class CreditService {
    /**
     * Get or create a user's credit record.
     */
    public static function getBalance(int $userId): array {
        $credits = Database::fetch(
            "SELECT * FROM user_credits WHERE user_id = ?",
            [$userId]
        );
        if (!$credits) {
            Database::insert('user_credits', [
                'user_id' => $userId,
                'credits_balance' => 0,
                'lifetime_credits_purchased' => 0,
                'lifetime_credits_used' => 0,
            ]);
            $credits = Database::fetch(
                "SELECT * FROM user_credits WHERE user_id = ?",
                [$userId]
            );
        }
        return $credits;
    }

    /**
     * Add credits to a user's balance atomically.
     */
    public static function addCredits(
        int $userId,
        int $amount,
        string $type,
        string $description,
        ?string $relatedEntityType = null,
        ?string $relatedEntityId = null
    ): int {
        Database::beginTransaction();
        try {
            // Lock the row to prevent concurrent modifications
            $credits = Database::fetch(
                "SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE",
                [$userId]
            );
            if (!$credits) {
                Database::insert('user_credits', [
                    'user_id' => $userId,
                    'credits_balance' => 0,
                    'lifetime_credits_purchased' => 0,
                    'lifetime_credits_used' => 0,
                ]);
                $credits = Database::fetch(
                    "SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE",
                    [$userId]
                );
            }

            $newBalance = (int)$credits['credits_balance'] + $amount;
            $lifetimePurchased = (int)$credits['lifetime_credits_purchased'];
            if ($amount > 0) {
                $lifetimePurchased += $amount;
            }

            Database::update('user_credits', [
                'credits_balance' => $newBalance,
                'lifetime_credits_purchased' => $lifetimePurchased,
            ], 'user_id = ?', [$userId]);

            Database::insert('credit_transactions', [
                'user_id' => $userId,
                'amount' => $amount,
                'type' => $type,
                'description' => $description,
                'balance_after' => $newBalance,
                'related_entity_type' => $relatedEntityType,
                'related_entity_id' => $relatedEntityId,
            ]);

            Database::commit();
            return $newBalance;
        } catch (\Exception $e) {
            Database::rollback();
            throw $e;
        }
    }

    /**
     * Deduct 1 credit for an AI message. Returns new balance.
     * @throws \RuntimeException if insufficient credits
     */
    public static function deductCredit(
        int $userId,
        string $description,
        ?string $relatedEntityType = null,
        ?string $relatedEntityId = null
    ): int {
        Database::beginTransaction();
        try {
            $credits = Database::fetch(
                "SELECT * FROM user_credits WHERE user_id = ? FOR UPDATE",
                [$userId]
            );
            if (!$credits || (int)$credits['credits_balance'] < 1) {
                Database::rollback();
                throw new \RuntimeException('Insufficient credits');
            }

            $newBalance = (int)$credits['credits_balance'] - 1;

            Database::update('user_credits', [
                'credits_balance' => $newBalance,
                'lifetime_credits_used' => (int)$credits['lifetime_credits_used'] + 1,
            ], 'user_id = ?', [$userId]);

            Database::insert('credit_transactions', [
                'user_id' => $userId,
                'amount' => -1,
                'type' => 'usage',
                'description' => $description,
                'balance_after' => $newBalance,
                'related_entity_type' => $relatedEntityType,
                'related_entity_id' => $relatedEntityId,
            ]);

            Database::commit();
            return $newBalance;
        } catch (\RuntimeException $e) {
            throw $e;
        } catch (\Exception $e) {
            Database::rollback();
            throw $e;
        }
    }

    /**
     * Initialize trial credits for a new user.
     */
    public static function initTrialCredits(int $userId): void {
        $config = require __DIR__ . '/../config/payment.php';
        $trialAmount = $config['trial_credits'] ?? 25;

        self::addCredits(
            $userId,
            $trialAmount,
            'trial',
            "Welcome bonus: {$trialAmount} free AI coaching credits"
        );
    }
}
