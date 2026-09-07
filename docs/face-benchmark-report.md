# Face Recognition Benchmark Report

**Status:** NOT YET CONDUCTED  
**Required before:** Phase 2 development begins

---

## Purpose

This report will document benchmark results comparing:

- **Candidate A:** MediaPipe + ONNX Runtime Web + Lightweight Embedding Model (browser)
- **Candidate B:** InsightFace Local Python Service

The winning approach will be used for Phase 2 face enrollment and recognition implementation.

---

## Test Conditions

### Device Matrix

| Device | OS | Notes |
|--------|----|-------|
| Low-end Android | Android 9+ | Target minimum spec |
| Mid-range Android | Android 11+ | |
| High-end Android | Android 13+ | |
| iPhone (mid) | iOS 15+ | |
| Tablet | Android 11+ | If required |

### Class Size Tests

| Students in Frame | Test Status |
|-------------------|-------------|
| 5 | ☐ Not yet tested |
| 10 | ☐ Not yet tested |
| 20 | ☐ Not yet tested |
| 30 | ☐ Not yet tested |
| 40+ | ☐ Not yet tested |

### Condition Matrix

| Condition | Test Status |
|-----------|-------------|
| Normal indoor lighting | ☐ |
| Low light | ☐ |
| Bright/backlit | ☐ |
| Glasses | ☐ |
| Masks | ☐ |
| Head angle variation | ☐ |
| Motion / walking | ☐ |
| Distance: 0.5m | ☐ |
| Distance: 1m | ☐ |
| Distance: 2m+ | ☐ |

---

## Metrics to Capture

For each candidate, per device, per class size:

| Metric | Candidate A | Candidate B |
|--------|-------------|-------------|
| Detection Accuracy (%) | | |
| Recognition Accuracy (%) | | |
| False Acceptance Rate (%) | | |
| False Rejection Rate (%) | | |
| Average FPS | | |
| Recognition Latency (ms) | | |
| CPU Usage (%) | | |
| Peak Memory (MB) | | |
| Battery Draw (mAh/hr) | | |
| Device Heating (subjective) | | |
| Model Load Time (ms, first) | | |
| Model Load Time (ms, warm) | | |

---

## Threshold Recommendations

Record thresholds after benchmark:

| Threshold | Value (TBD) |
|-----------|-------------|
| Auto-accept above | |
| Manual review range | |
| Reject below | |

---

## Final Decision

> **To be filled after benchmark is complete.**

**Winner:** TBD  
**Model selected:** TBD  
**Model version:** TBD  
**Embedding dimension:** TBD  
**Reasoning:** TBD  
**Date decided:** TBD  
**Decided by:** TBD

---

## Notes

- Do NOT write face enrollment or recognition code before this report is complete
- The `face_embedding.model_name` and `face_embedding.model_version` fields must be populated from this decision
- Re-enrollment of all students is required if the model is changed after launch
