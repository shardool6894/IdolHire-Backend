// The one place that decides which question-sequence domain belongs to which interview type.
// Used when listing sequences, when creating an assessment, and when a candidate joins, so the
// three can never disagree about what an "SDE" interview is allowed to contain.
//
// Note: "General" sequences are intentionally not mapped to either type. If you want them usable
// in both, change domainsFor() to return ["SDE", "General"] / ["Manufacturing", "General"].

const DOMAIN_FOR_TYPE = {
  SDE: "SDE",
  "Non-SDE": "Manufacturing",
};

const INTERVIEW_TYPES = Object.keys(DOMAIN_FOR_TYPE);

const isInterviewType = (value) => typeof value === "string" && Object.hasOwn(DOMAIN_FOR_TYPE, value);

const domainFor = (typeOfInterview) => DOMAIN_FOR_TYPE[typeOfInterview];

// True when a sequence (anything with a `domain`) is allowed in an interview of this type.
const sequenceMatchesType = (sequence, typeOfInterview) =>
  Boolean(sequence) && isInterviewType(typeOfInterview) && sequence.domain === domainFor(typeOfInterview);

module.exports = { INTERVIEW_TYPES, isInterviewType, domainFor, sequenceMatchesType };
