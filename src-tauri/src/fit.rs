//! `fit to my reviews`: FSRS-7's weights fitted to a collection's own
//! reviews by the `fsrs` crate's optimiser, on the CPU, with no model file.
//!
//! A fit takes each card's reviews as the review log has them (an instant
//! and a grade) and gives the 34 weights back. An item, as the optimiser
//! counts them, is a review of a card that had one before it; under
//! `MIN_ITEMS` of them (the crate's own `MIN_ITEMS_TO_TRAIN`), or with no
//! card reviewed a day or more after its review before, it gives its
//! defaults back unchanged, and `fitted` says so.

use fsrs::{CardPrefix, CardPrefixes, CardReviews, ComputeParametersInput, ComputeParametersVersion, FSRSReview, compute_parameters_from_card_prefixes};
use serde::{Deserialize, Serialize};

/// The optimiser trains from this many items; with fewer it returns its defaults.
pub const MIN_ITEMS: usize = 64;

/// One grade: when, in seconds since the epoch, and 1 to 4.
#[derive(Deserialize, Debug, Clone, Copy)]
pub struct FitReview {
    pub t: f64,
    pub g: u32,
}

#[derive(Serialize, Debug)]
pub struct Fit {
    /// FSRS-7's weights.
    pub w: Vec<f32>,
    /// The items they were fitted from.
    pub items: usize,
    /// False when there was too little to train from and `w` is the defaults.
    pub fitted: bool,
}

/// Each card's reviews as the optimiser reads them: oldest first, the days since the one before (fractions kept), the
/// first at 0; and every review after a card's first as an item, oldest first, since a later item weighs more.
fn prefixes(cards: &[Vec<FitReview>]) -> CardPrefixes {
    let mut out = Vec::new();
    let mut items: Vec<(f64, CardPrefix)> = Vec::new();
    for card in cards {
        let mut list: Vec<FitReview> = card.iter().copied().filter(|r| (1..=4).contains(&r.g) && r.t.is_finite()).collect();
        if list.is_empty() {
            continue;
        }
        list.sort_by(|a, b| a.t.total_cmp(&b.t));
        let card_index = out.len() as u32;
        let mut last = list[0].t;
        let mut reviews = Vec::with_capacity(list.len());
        for (len, r) in (1..).zip(&list) {
            reviews.push(FSRSReview { rating: r.g, delta_t: ((r.t - last) / 86_400.0).max(0.0) as f32 });
            last = r.t;
            if len > 1 {
                items.push((r.t, CardPrefix { card_index, len }));
            }
        }
        out.push(CardReviews { card_id: card_index as i64, reviews });
    }
    items.sort_by(|a, b| a.0.total_cmp(&b.0));
    CardPrefixes { cards: out, prefixes: items.into_iter().map(|(_, p)| p).collect() }
}

/// FSRS-7's weights fitted to `cards`, each one card's reviews.
pub fn fit(cards: &[Vec<FitReview>]) -> Result<Fit, String> {
    let set = prefixes(cards);
    let items = set.prefixes.len();
    // the optimiser's own test: something to train from is an item with more than one review a day or more on
    let long = set.prefixes.iter().any(|p| {
        let reviews = &set.cards[p.card_index as usize].reviews[..p.len as usize];
        reviews.iter().filter(|r| r.delta_t >= 1.0).count() != 1
    });
    let input = ComputeParametersInput { model_version: ComputeParametersVersion::Fsrs7, ..Default::default() };
    let w = compute_parameters_from_card_prefixes(&set, input).map_err(|e| format!("could not fit: {e:?}"))?;
    if w.iter().any(|x| !x.is_finite()) {
        return Err("could not fit: a weight that is not a number".to_string());
    }
    Ok(Fit { w, items, fitted: items >= MIN_ITEMS && long })
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: f64 = 86_400.0;

    /// Cards reviewed over a year by someone who forgets about one review in six.
    fn history(cards: usize) -> Vec<Vec<FitReview>> {
        (0..cards)
            .map(|c| {
                let mut t = (c % 40) as f64 * DAY;
                let mut gap = 1.0;
                (0..9)
                    .map(|i| {
                        let g = if (c * 7 + i * 13) % 6 == 0 { 1 } else if (c + i) % 5 == 0 { 4 } else { 3 };
                        let r = FitReview { t, g };
                        gap = if g == 1 { 1.0 } else { gap * 2.2 };
                        t += gap * DAY + (c % 7) as f64 * 3600.0;
                        r
                    })
                    .collect()
            })
            .collect()
    }

    #[test]
    fn too_little_gives_the_defaults_and_says_so() {
        let few = history(3);
        let fit = fit(&few).unwrap();
        assert_eq!(fit.items, 24);
        assert!(!fit.fitted);
        assert_eq!(fit.w, fsrs::DEFAULT_PARAMETERS.to_vec());
        // nothing at all is no error either
        let none = super::fit(&[]).unwrap();
        assert_eq!((none.items, none.fitted), (0, false));
    }

    #[test]
    fn a_history_is_fitted_to_weights_of_its_own() {
        let fit = fit(&history(120)).unwrap();
        assert_eq!(fit.items, 120 * 8);
        assert!(fit.fitted);
        // the 34 weights the renderer's FSRS-7 (ts-fsrs 6) reads, in its order
        assert_eq!(fit.w.len(), 34);
        assert!(fit.w.iter().all(|x| x.is_finite()));
        assert_ne!(fit.w, fsrs::DEFAULT_PARAMETERS.to_vec());
        // the same reviews give the same weights
        assert_eq!(fit.w, super::fit(&history(120)).unwrap().w);
    }

    #[test]
    fn the_defaults_are_the_ones_the_renderer_has() {
        // `FSRS7_DEFAULT_WEIGHTS` of ts-fsrs 6.0.0, which `src/schedule/fsrs7.ts` schedules with until a fit
        let ts: [f32; 34] = [
            0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0.0, 1.3826, 0.7024, 0.5999, 0.8146, 0.6398, 1.0, 1.3207, 0.6707, 3.8668, 0.4416, 0.0934, 1.8631, 0.6162, 1.0869,
            0.1567, 0.0801, 0.2421, 0.9464, 0.1433, 0.7145, 0.0, 0.5667, 0.3734, 0.5333, 0.3048,
        ];
        assert_eq!(fsrs::DEFAULT_PARAMETERS, ts);
    }

    /// Seconds since the epoch of `2026-10-30T08:15:02Z`.
    fn instant(at: &str) -> f64 {
        let n = |a: usize, b: usize| at[a..b].parse::<i64>().unwrap();
        let (y, m, d) = (n(0, 4), n(5, 7), n(8, 10));
        // days from the civil date (Howard Hinnant's)
        let y = if m <= 2 { y - 1 } else { y };
        let era = y.div_euclid(400);
        let yoe = y.rem_euclid(400);
        let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
        let days = era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468;
        (days * 86_400 + n(11, 13) * 3600 + n(14, 16) * 60 + n(17, 19)) as f64
    }

    /// The sample collection's review log as `fitCards` (`src/schedule/fsrs7.ts`) sends it: each line of a card from
    /// its first review (`st` new) on, a line the log does not have from its start left out.
    fn sample() -> Vec<Vec<FitReview>> {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../samples/double-major/.ilmi/reviews");
        let mut names: Vec<_> = std::fs::read_dir(dir).unwrap().filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.extension().is_some_and(|x| x == "jsonl")).collect();
        names.sort();
        let mut lines: std::collections::BTreeMap<String, Vec<(String, u32, bool)>> = Default::default();
        for name in names {
            for line in std::fs::read_to_string(name).unwrap().lines() {
                let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else { continue };
                let (Some(at), Some(card), Some(g), Some(st)) = (v["at"].as_str(), v["card"].as_str(), v["g"].as_u64(), v["st"].as_str()) else { continue };
                lines.entry(format!("{card}\n{}", v["key"].as_str().unwrap_or(""))).or_default().push((at.to_string(), g as u32, st == "new"));
            }
        }
        let mut out = Vec::new();
        for (_, mut list) in lines {
            list.sort();
            let mut run: Option<Vec<FitReview>> = None;
            for (at, g, new) in list {
                if new {
                    if let Some(done) = run.take() {
                        out.push(done);
                    }
                    run = Some(Vec::new());
                }
                if let Some(r) = run.as_mut() {
                    r.push(FitReview { t: instant(&at), g });
                }
            }
            out.extend(run);
        }
        out
    }

    /// The sample collection's own log, fitted. `ILMI_FIT_FIXTURE=<file>` writes the weights there (`npm run
    /// fixture:fit`), for `fsrs7.test.ts` to read them as the renderer does and hold them against the same log.
    #[test]
    fn fits_the_sample_collection() {
        assert_eq!(instant("1970-01-02T00:00:01Z"), 86_401.0);
        assert_eq!(instant("2026-10-30T08:15:02Z"), 1_793_348_102.0);
        let cards = sample();
        let reviews: usize = cards.iter().map(|c| c.len()).sum();
        let began = std::time::Instant::now();
        let fit = fit(&cards).unwrap();
        println!("fit: {} cards, {reviews} reviews, {} items in {:?}", cards.len(), fit.items, began.elapsed());
        assert!(fit.fitted);
        assert_eq!(fit.items, reviews - cards.len());
        assert_eq!(fit.w.len(), 34);
        assert_ne!(fit.w, fsrs::DEFAULT_PARAMETERS.to_vec());
        if let Ok(to) = std::env::var("ILMI_FIT_FIXTURE") {
            let out = serde_json::json!({ "w": fit.w, "items": fit.items, "reviews": reviews, "cards": cards.len() });
            std::fs::write(to, format!("{}\n", serde_json::to_string(&out).unwrap())).unwrap();
        }
    }

    #[test]
    fn reviews_are_read_oldest_first_with_fractions_of_a_day() {
        let set = prefixes(&[vec![FitReview { t: 2.5 * DAY, g: 3 }, FitReview { t: 0.0, g: 1 }, FitReview { t: 600.0, g: 3 }, FitReview { t: 9.0, g: 7 }]]);
        let r = &set.cards[0].reviews;
        assert_eq!(r.iter().map(|x| x.rating).collect::<Vec<_>>(), vec![1, 3, 3]);
        assert_eq!(r[0].delta_t, 0.0);
        assert!((r[1].delta_t - 600.0 / 86_400.0).abs() < 1e-6);
        assert!((r[2].delta_t - (2.5 - 600.0 / 86_400.0)).abs() < 1e-4);
        assert_eq!(set.prefixes.iter().map(|p| p.len).collect::<Vec<_>>(), vec![2, 3]);
    }
}
