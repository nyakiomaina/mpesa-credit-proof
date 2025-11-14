use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ProofInput {
    pub transactions: Vec<Transaction>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Transaction {
    pub timestamp: i64,
    pub amount: u64,
    pub transaction_type: String,
    pub reference: String,
}

#[derive(Serialize, Deserialize)]
pub struct ProofOutput {
    pub till_number_hash: [u8; 32],
    pub period_start: i64,
    pub period_end: i64,
    pub credit_score: u32,
    pub metrics: BusinessMetrics,
}

#[derive(Serialize, Deserialize)]
pub struct BusinessMetrics {
    pub monthly_volume_range: VolumeRange,
    pub consistency_score: u8,
    pub growth_trend: GrowthTrend,
    pub active_days_percentage: u8,
    pub customer_diversity_score: u8,
}

#[derive(Serialize, Deserialize)]
pub enum VolumeRange {
    VeryLow,
    Low,
    Medium,
    High,
    VeryHigh,
}

#[derive(Serialize, Deserialize)]
pub enum GrowthTrend {
    Declining,
    Stable,
    Growing,
    Rapid,
}

fn main() {
    // Read input
    let input: ProofInput = env::read();

    // Validate and filter transactions
    // Process all valid transactions regardless of age (for historical data analysis)
    let now = input.transactions.iter().map(|t| t.timestamp).max().unwrap_or(0);

    // Filter by transaction type and amount only (no time-based filtering for historical data)
    let valid_transactions: Vec<Transaction> = input
        .transactions
        .into_iter()
        .filter(|t| t.amount > 0)
        .filter(|t| t.transaction_type == "Payment" || t.transaction_type == "Reversal")
        .collect();

    if valid_transactions.is_empty() {
        // No valid transactions - return 0 score to indicate failure
        let output = ProofOutput {
            till_number_hash: [0u8; 32],
            period_start: now,
            period_end: now,
            credit_score: 0,
            metrics: BusinessMetrics {
                monthly_volume_range: VolumeRange::VeryLow,
                consistency_score: 0,
                growth_trend: GrowthTrend::Declining,
                active_days_percentage: 0,
                customer_diversity_score: 0,
            },
        };
        env::commit(&output);
        return;
    }

    // Debug: We have valid transactions, so we should calculate a score > 0

    // Group transactions by day
    let daily_volumes = group_by_day(&valid_transactions);

    let period_start = valid_transactions.iter().map(|t| t.timestamp).min().unwrap();
    let period_end = valid_transactions.iter().map(|t| t.timestamp).max().unwrap();

    // Calculate metrics
    let total_volume = valid_transactions.iter().map(|t| t.amount).sum::<u64>();
    let days_in_period = calculate_days_between(period_start, period_end);

    let monthly_volume = if days_in_period > 0 {
        (total_volume as f64 / days_in_period as f64) * 30.0
    } else {
        0.0
    };

    let monthly_volume_range = categorize_volume(monthly_volume as u64);

    // Calculate consistency score
    let consistency_score = calculate_consistency(&daily_volumes);

    // Calculate active days percentage
    let active_days = daily_volumes.len() as u64;
    let active_days_percentage = if days_in_period > 0 {
        ((active_days as f64 / days_in_period as f64) * 100.0) as u8
    } else {
        0
    };

    // Calculate growth trend
    let growth_trend = calculate_growth_trend(&daily_volumes);

    // Calculate customer diversity (based on unique references)
    let unique_references: std::collections::HashSet<String> = valid_transactions
        .iter()
        .map(|t| t.reference.clone())
        .collect();
    let customer_diversity_score = if valid_transactions.len() > 0 {
        ((unique_references.len() as f64 / valid_transactions.len() as f64) * 100.0) as u8
    } else {
        0
    };

    // Calculate credit score
    let credit_score = calculate_credit_score(
        &monthly_volume_range,
        consistency_score,
        active_days_percentage,
        &growth_trend,
        customer_diversity_score,
    );

    let output = ProofOutput {
        till_number_hash: [0u8; 32], // Will be set by host
        period_start,
        period_end,
        credit_score,
        metrics: BusinessMetrics {
            monthly_volume_range,
            consistency_score,
            growth_trend,
            active_days_percentage,
            customer_diversity_score,
        },
    };

    env::commit(&output);
}

fn group_by_day(transactions: &[Transaction]) -> std::collections::HashMap<i64, Vec<u64>> {
    let mut daily: std::collections::HashMap<i64, Vec<u64>> = std::collections::HashMap::new();

    for tx in transactions {
        let day_timestamp = tx.timestamp / (24 * 60 * 60); // Days since epoch
        daily.entry(day_timestamp).or_insert_with(Vec::new).push(tx.amount);
    }

    daily
}

fn calculate_days_between(start: i64, end: i64) -> u64 {
    let diff = end - start;
    if diff <= 0 {
        1 // Minimum 1 day to avoid division by zero
    } else {
        // Calculate days, ensuring at least 1 day
        let days = (diff / (24 * 60 * 60)) as u64;
        days.max(1) // Ensure at least 1 day
    }
}

fn categorize_volume(monthly_volume: u64) -> VolumeRange {
    // Convert to KSh (assuming amounts are in cents)
    let volume_ksh = monthly_volume / 100;

    if volume_ksh < 50_000 {
        VolumeRange::VeryLow
    } else if volume_ksh < 250_000 {
        VolumeRange::Low
    } else if volume_ksh < 1_000_000 {
        VolumeRange::Medium
    } else if volume_ksh < 5_000_000 {
        VolumeRange::High
    } else {
        VolumeRange::VeryHigh
    }
}

fn calculate_consistency(daily_volumes: &std::collections::HashMap<i64, Vec<u64>>) -> u8 {
    if daily_volumes.is_empty() {
        return 0;
    }

    let daily_totals: Vec<u64> = daily_volumes
        .values()
        .map(|amounts| amounts.iter().sum())
        .collect();

    let mean = daily_totals.iter().sum::<u64>() as f64 / daily_totals.len() as f64;

    if mean == 0.0 {
        return 0;
    }

    let variance = daily_totals
        .iter()
        .map(|&x| {
            let diff = x as f64 - mean;
            diff * diff
        })
        .sum::<f64>() / daily_totals.len() as f64;

    let std_dev = variance.sqrt();
    let coefficient_of_variation = if mean > 0.0 {
        std_dev / mean
    } else {
        return 0;
    };

    // Convert CV to score (lower CV = higher consistency)
    // CV of 0 = 100, CV of 1.0 = 0, CV of 0.5 = 50
    let score = (1.0 - coefficient_of_variation.min(1.0)) * 100.0;
    score.max(0.0).min(100.0) as u8
}

fn calculate_growth_trend(daily_volumes: &std::collections::HashMap<i64, Vec<u64>>) -> GrowthTrend {
    if daily_volumes.len() < 2 {
        return GrowthTrend::Stable;
    }

    let mut sorted_days: Vec<&i64> = daily_volumes.keys().collect();
    sorted_days.sort();

    // Split into three periods for trend analysis
    let third = sorted_days.len() / 3;
    if third == 0 {
        return GrowthTrend::Stable;
    }

    let first_period: u64 = sorted_days[..third]
        .iter()
        .flat_map(|&day| daily_volumes[day].iter())
        .sum();

    let last_period: u64 = sorted_days[sorted_days.len() - third..]
        .iter()
        .flat_map(|&day| daily_volumes[day].iter())
        .sum();

    let first_avg = first_period as f64 / third as f64;
    let last_avg = last_period as f64 / third as f64;

    if first_avg == 0.0 {
        return GrowthTrend::Stable;
    }

    let growth_rate = (last_avg - first_avg) / first_avg;

    if growth_rate < -0.2 {
        GrowthTrend::Declining
    } else if growth_rate < 0.1 {
        GrowthTrend::Stable
    } else if growth_rate < 0.5 {
        GrowthTrend::Growing
    } else {
        GrowthTrend::Rapid
    }
}

fn calculate_credit_score(
    volume_range: &VolumeRange,
    consistency_score: u8,
    active_days_percentage: u8,
    growth_trend: &GrowthTrend,
    customer_diversity_score: u8,
) -> u32 {
    // Volume Component (30 points)
    let volume_points = match volume_range {
        VolumeRange::VeryLow => 5,
        VolumeRange::Low => 10,
        VolumeRange::Medium => 20,
        VolumeRange::High => 25,
        VolumeRange::VeryHigh => 30,
    };

    // Consistency Component (30 points)
    let consistency_points = (consistency_score as f64 * 0.3) as u32;

    // Activity Component (20 points)
    let activity_points = ((active_days_percentage as f64 / 100.0) * 20.0) as u32;

    // Growth Component (10 points)
    let growth_points = match growth_trend {
        GrowthTrend::Declining => 0,
        GrowthTrend::Stable => 5,
        GrowthTrend::Growing => 7,
        GrowthTrend::Rapid => 10,
    };

    // Diversity Component (10 points)
    let diversity_points = ((customer_diversity_score as f64 / 100.0) * 10.0) as u32;

    let total = volume_points + consistency_points + activity_points + growth_points + diversity_points;

    // Always return at least volume_points if we have any volume
    // This ensures that even if all other metrics are 0, we still get a score based on volume
    if volume_points > 0 {
        total.max(volume_points)
    } else {
        // No volume means no transactions were processed
        0
    }
}
