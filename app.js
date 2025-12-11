const DATA_SOURCES = {
  patients: {
    key: "patients",
    label: "PatientData",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbCntHSAg9g6PBkf6PcHV7j1gKLf2peYJmjv2cMUFbIYCjc-pAguEEbpErcwtghmukwG3eWwNLHRVK/pub?gid=458283333&single=true&output=csv",
  },
};

const APPOINTMENT_SHEETS = [
  {
    key: "islam",
    label: "Islam",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbCntHSAg9g6PBkf6PcHV7j1gKLf2peYJmjv2cMUFbIYCjc-pAguEEbpErcwtghmukwG3eWwNLHRVK/pub?gid=0&single=true&output=csv",
  },
  {
    key: "abdelrahman",
    label: "Abdelrahman",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbCntHSAg9g6PBkf6PcHV7j1gKLf2peYJmjv2cMUFbIYCjc-pAguEEbpErcwtghmukwG3eWwNLHRVK/pub?gid=1726882582&single=true&output=csv",
  },
  {
    key: "parth",
    label: "Parth",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbCntHSAg9g6PBkf6PcHV7j1gKLf2peYJmjv2cMUFbIYCjc-pAguEEbpErcwtghmukwG3eWwNLHRVK/pub?gid=1683342420&single=true&output=csv",
  },
  {
    key: "nithasha",
    label: "Nithasha",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbCntHSAg9g6PBkf6PcHV7j1gKLf2peYJmjv2cMUFbIYCjc-pAguEEbpErcwtghmukwG3eWwNLHRVK/pub?gid=398878177&single=true&output=csv",
  },
];

const CORS_PROXIES = [
  "https://corsproxy.io/?",
  "https://cors.isomorphic-git.org/",
];
const SHOULD_PREFER_PROXY =
  typeof window !== "undefined" && window.location?.protocol === "file:";

const FIELD_ALIASES = {
  patientId: ["patient id", "patientid", "id"],
  status: ["status", "patient status"],
  dateCreated: ["date created", "created", "created at"],
  firstName: ["first name", "firstname", "name first"],
  lastName: ["last name", "lastname", "name last"],
  birthdate: ["birthdate", "dob", "date of birth"],
  address: ["primary address", "address", "street"],
  city: ["primary address city", "city"],
  postalCode: ["primary address postalcode", "zip", "postal code"],
  therapist: ["pt", "therapist", "provider", "provider name"],
  phone: ["mobile", "phone", "contact", "cell"],
  area: ["area", "zone", "territory"],
  followUp: ["latest follow-up action taken", "latest follow up", "last action"],
  referredBy: ["referred by", "referrer"],
  lostReason: ["lost reason"],
  bookingSource: ["booking source"],
  leadSourceHc: ["hc source of lead", "hc source", "hc lead source"],
  leadSource: ["source of lead", "lead source"],
  insurance1: ["insurance 1", "primary insurance"],
  insurance2: ["insurance 2", "secondary insurance"],
  insuranceStatus1: ["insurance status 1"],
  insuranceStatus2: ["insurance status 2"],
  authorization: ["authroization", "authorization"],
  emrId: ["emr id"],
  newPatientSource: ["new patient source"],
  physicianId: ["physician id"],
  patientBirthday: ["hc patient birthday", "birthday", "patient birthday", "dob"],
  preferredDays: ["preferred days"],
  earliestTime: ["earliest time"],
  latestTime: ["latest time"],
  assignedFlag: ["assigned"],
  assignedTo: ["assigned to"],
  appointmentDate: ["date of appointment", "appointment date"],
  appointmentProvider: ["provider id", "provider"],
  appointmentStatus: ["status", "appointment status"],
  appointmentType: ["type", "appointment type"],
  appointmentNoteDone: ["note done", "documentation complete"],
  numberTotalLeads: ["total leads"],
  numberPendingPt: ["pending pt", "pending therapist", "open pt"],
  numberInsuranceIssues: ["insurance not accepted", "insurance issues"],
};

const MATCH_CACHE = new Map();

const REVENUE_PER_VISIT = 90; // average reimbursement per completed visit

const state = {
  isLoading: true,
  error: null,
  lastUpdated: null,
  data: {
    patients: [],
    appointments: [],
  },
  headers: {
    patients: [],
    appointments: [],
  },
  metrics: {},
  charts: {},
  filters: {
    area: "all",
    status: "all",
    therapist: "all",
    insurance: "all",
    leadSource: "all",
    bookingSource: "all",
    authorization: "all",
    appointmentType: "all",
    patientId: "all",
    provider: "all",
    dateStart: "",
    dateEnd: "",
    search: "",
    metricsStart: "",
    metricsEnd: "",
  },
};

const appEl = document.getElementById("app");

async function bootstrap() {
  try {
    render();
    await loadAllData();
    state.isLoading = false;
    state.lastUpdated = new Date();
    computeMetrics();
    render();
  } catch (error) {
    console.error(error);
    state.error = error;
    state.isLoading = false;
    render();
  }
}

async function loadAllData() {
  const patientPromise = (async () => {
    const text = await fetchCsv(DATA_SOURCES.patients.url);
    return parseCsv(text);
  })();

  const appointmentPromises = APPOINTMENT_SHEETS.map(async (sheet) => {
    const text = await fetchCsv(sheet.url);
    return { sheet, parsed: parseCsv(text) };
  });

  const [patientsParsed, appointmentResults] = await Promise.all([
    patientPromise,
    Promise.all(appointmentPromises),
  ]);

  state.headers.patients = patientsParsed.meta.fields || [];
  state.data.patients = patientsParsed.data;

  const appointmentHeaderSet = new Set();
  const appointmentRows = [];

  appointmentResults.forEach(({ sheet, parsed }) => {
    (parsed.meta.fields || []).forEach((header) => appointmentHeaderSet.add(header));
    parsed.data.forEach((row) => {
      appointmentRows.push({ ...row, __sheet: sheet.label });
    });
  });

  state.headers.appointments = Array.from(appointmentHeaderSet);
  state.data.appointments = appointmentRows;

  return true;
}

async function fetchCsv(url) {
  const attempt = async (targetUrl) => {
    const response = await fetch(targetUrl, {
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${targetUrl}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  };

  const attemptViaProxies = async () => {
    let lastError;
    for (const proxy of CORS_PROXIES) {
      if (!proxy) continue;
      try {
        return await attempt(`${proxy}${url}`);
      } catch (error) {
        lastError = error;
        console.warn(`Proxy fetch failed via ${proxy}`, error);
      }
    }
    if (lastError) throw lastError;
    throw new Error("No CORS proxy available for request.");
  };

  if (SHOULD_PREFER_PROXY) {
    try {
      return await attemptViaProxies();
    } catch (proxyError) {
      console.info("Proxy fetch failed, retrying direct source.", proxyError);
      return attempt(url);
    }
  }

  try {
    return await attempt(url);
  } catch (error) {
    if (!shouldRetryWithProxy(error)) {
      throw error;
    }
    console.info("Direct fetch failed, retrying via proxy.", error);
    try {
      return await attemptViaProxies();
    } catch (proxyError) {
      const message = `Unable to load ${url}. (${proxyError.message})`;
      const combined = new Error(message);
      combined.cause = proxyError;
      throw combined;
    }
  }
}

function shouldRetryWithProxy(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error instanceof TypeError ||
    message.includes("failed to fetch") ||
    message.includes("cors") ||
    message.includes("network")
  );
}

function parseCsv(text) {
  return Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
    transform: (value) => (typeof value === "string" ? value.trim() : value),
  });
}

function normalizeKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchField(row, aliases) {
  if (!row || !aliases?.length) return undefined;
  const keys = Object.keys(row);
  if (!keys.length) return undefined;

  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    if (MATCH_CACHE.has(normalizedAlias)) {
      const cachedKey = MATCH_CACHE.get(normalizedAlias);
      if (cachedKey && cachedKey in row) {
        const value = row[cachedKey];
        if (value !== undefined) return value;
      }
    }
  }

  for (const key of keys) {
    const normalizedKey = normalizeKey(key);
    for (const alias of aliases) {
      const normalizedAlias = normalizeKey(alias);
      if (normalizedKey === normalizedAlias) {
        MATCH_CACHE.set(normalizedAlias, key);
        return row[key];
      }
    }
  }

  for (const key of keys) {
    const normalizedKey = normalizeKey(key);
    for (const alias of aliases) {
      const normalizedAlias = normalizeKey(alias);
      if (normalizedKey.includes(normalizedAlias) || normalizedAlias.includes(normalizedKey)) {
        MATCH_CACHE.set(normalizedAlias, key);
        return row[key];
      }
    }
  }

  return undefined;
}

function getField(row, aliasKey) {
  const aliases = FIELD_ALIASES[aliasKey];
  if (!aliases) return undefined;
  return matchField(row, aliases);
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  if (!value) return null;
  let parsed = luxon.DateTime.fromJSDate(new Date(value));
  if (!parsed.isValid) {
    parsed = luxon.DateTime.fromFormat(value, "MM/dd/yyyy");
  }
  if (!parsed.isValid) {
    parsed = luxon.DateTime.fromFormat(value, "yyyy-MM-dd");
  }
  if (!parsed.isValid) return null;
  return parsed;
}

function computeMetrics() {
  const patients = state.data.patients;
  const appointments = state.data.appointments;
  const metricsStart = state.filters.metricsStart
    ? luxon.DateTime.fromISO(state.filters.metricsStart).startOf("day")
    : null;
  const metricsEnd = state.filters.metricsEnd
    ? luxon.DateTime.fromISO(state.filters.metricsEnd).endOf("day")
    : null;

  const leadCandidates = patients.filter((row) => {
    const created = parseDate(getField(row, "dateCreated"));
    if (metricsStart && (!created || created < metricsStart)) return false;
    if (metricsEnd && (!created || created > metricsEnd)) return false;
    const area = normalizeText(getField(row, "area"));
    const bookingSource = normalizeText(getField(row, "bookingSource"));
    const leadSource = normalizeText(getField(row, "leadSource") || getField(row, "leadSourceHc"));
    if (state.filters.area !== "all" && area !== state.filters.area) return false;
    if (state.filters.leadSource !== "all") {
      const match = bookingSource === state.filters.leadSource || leadSource === state.filters.leadSource;
      if (!match) return false;
    }
    return true;
  });

  const patientIdSet = new Set();
  const acceptedIds = new Set();
  const rejectedIds = new Set();
  const pendingIds = new Set();
  const patientFlags = {};
  const patientArea = {};

  leadCandidates.forEach((row) => {
    const patientId = getField(row, "patientId");
    if (!patientId) return;
    patientIdSet.add(patientId);
    patientArea[patientId] = normalizeText(getField(row, "area")) || patientArea[patientId];
    const status = normalizeText(getField(row, "status"));
    const isRejected =
      status.includes("insurance not accepted") ||
      status.includes("not accepted") ||
      status.includes("insurance rejected") ||
      status.includes("not covered");
    const flags = patientFlags[patientId] || { rejected: false, accepted: false, pending: false };
    if (isRejected) flags.rejected = true;
    else flags.accepted = true;
    if (flags.accepted && isPendingLead(row)) {
      flags.pending = true;
    }
    patientFlags[patientId] = flags;
  });

  Object.entries(patientFlags).forEach(([id, flags]) => {
    if (flags.rejected) {
      rejectedIds.add(id);
      return;
    }
    if (flags.accepted) {
      acceptedIds.add(id);
      if (flags.pending) pendingIds.add(id);
    }
  });

  const patientCount = patientIdSet.size;

  const therapistCount = new Set(
    patients
      .map((row) => getField(row, "assignedTo") || "")
      .map((value) => value.split(","))
      .flat()
      .map((value) => value.trim())
      .filter(Boolean)
  ).size;

  const areaCount = new Set(
    patients
      .map((row) => (getField(row, "area") || "").trim())
      .filter((value) => Boolean(value))
  ).size;

  const areaDistribution = Object.entries(
    patients.reduce((acc, row) => {
      const area = (getField(row, "area") || "Unspecified").trim() || "Unspecified";
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const insuranceDistribution = Object.entries(
    patients.reduce((acc, row) => {
      const insuranceKeys = ["insurance1", "insurance2"];
      insuranceKeys.forEach((key) => {
        const value = getField(row, key);
        if (value) {
          const normalized = value.trim() || "Unspecified";
          acc[normalized] = (acc[normalized] || 0) + 1;
        }
      });
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const appointmentRecords = appointments
    .map((row) => {
      const patientId = getField(row, "patientId");
      const date = parseDate(getField(row, "appointmentDate"));
      const status = (getField(row, "appointmentStatus") || "").toLowerCase();
      const type = getField(row, "appointmentType");
      const provider = (getField(row, "appointmentProvider") || row.__sheet || "").trim();
      const noteRaw = String(getField(row, "appointmentNoteDone") ?? "")
        .trim()
        .toLowerCase();
      let noteCompleted = null;
      if (noteRaw) {
        noteCompleted = ["true", "yes", "done", "y", "1"].includes(noteRaw);
      }
      return { patientId, date, status, type, provider, noteCompleted };
    })
    .filter((record) => record.patientId && record.date?.isValid)
    .filter((record) => {
      if (state.filters.provider !== "all" && record.provider.toLowerCase() !== state.filters.provider) {
        return false;
      }
      if (state.filters.area !== "all") {
        const area = patientArea[record.patientId]?.toLowerCase();
        if (area !== state.filters.area) return false;
      }
      if (metricsStart && record.date < metricsStart) return false;
      if (metricsEnd && record.date > metricsEnd) return false;
      return true;
    });

  const now = luxon.DateTime.now();
  const thirtyDaysAgo = now.minus({ days: 30 });
  const sixtyDaysAgo = now.minus({ days: 60 });

  const appointmentsLast30 = appointmentRecords.filter(
    (record) => record.date >= thirtyDaysAgo && record.date <= now
  );

  const appointmentsPrev30 = appointmentRecords.filter(
    (record) => record.date >= sixtyDaysAgo && record.date < thirtyDaysAgo
  );

  const totalAppointments = appointmentRecords.length;
  const totalAttended = appointmentRecords.filter((record) =>
    ["attended", "completed", "done"].some((keyword) => record.status.includes(keyword))
  ).length;
  const attendanceRate = totalAppointments ? totalAttended / totalAppointments : 0;

  const attendedLast30 = appointmentsLast30.filter((record) =>
    ["attended", "completed", "done"].some((keyword) => record.status.includes(keyword))
  ).length;
  const attendanceLast30 = appointmentsLast30.length
    ? attendedLast30 / appointmentsLast30.length
    : 0;

  const attendedPrev30 = appointmentsPrev30.filter((record) =>
    ["attended", "completed", "done"].some((keyword) => record.status.includes(keyword))
  ).length;
  const attendancePrev30 = appointmentsPrev30.length
    ? attendedPrev30 / appointmentsPrev30.length
    : 0;

  const appointmentTrend = aggregateByWeek(appointmentRecords);

  const providerVolume = {};
  const providerLabels = {};
  const patientProviders = {};
  const patientAppointmentTypes = {};
  let cancelCount = 0;
  let docsPending = 0;

  appointmentRecords.forEach((record) => {
    const patientKey = record.patientId?.toLowerCase();
    const providerKey = record.provider ? record.provider.toLowerCase() : "";

    if (patientKey && providerKey) {
      providerVolume[providerKey] = (providerVolume[providerKey] || 0) + 1;
      providerLabels[providerKey] = record.provider;
      (patientProviders[patientKey] ??= new Set()).add(providerKey);
    }

    if (patientKey && record.type) {
      (patientAppointmentTypes[patientKey] ??= new Set()).add(
        record.type.toLowerCase()
      );
    }

    if (record.status && /(cancel|no[\s-]?show|resched)/.test(record.status)) {
      cancelCount += 1;
    }

    if (record.noteCompleted === false) {
      docsPending += 1;
    }
  });

  const providerLeaders = Object.entries(providerVolume)
    .map(([key, count]) => ({
      provider: providerLabels[key] || key,
      providerKey: key,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const uniqueProviderCount = Object.keys(providerVolume).length;

  const uniquePatientsLast30 = new Set(appointmentsLast30.map((record) => record.patientId)).size;
  const uniquePatientsPrev30 = new Set(appointmentsPrev30.map((record) => record.patientId)).size;

  const firstAppointmentByPatient = appointmentRecords.reduce((acc, record) => {
    if (!acc[record.patientId] || record.date < acc[record.patientId]) {
      acc[record.patientId] = record.date;
    }
    return acc;
  }, {});

  const lastAppointmentByPatient = appointmentRecords.reduce((acc, record) => {
    if (!acc[record.patientId] || record.date > acc[record.patientId]) {
      acc[record.patientId] = record.date;
    }
    return acc;
  }, {});

  const newPatientsLast30 = Object.values(firstAppointmentByPatient).filter(
    (date) => date >= thirtyDaysAgo && date <= now
  ).length;

  const newPatientsPrev30 = Object.values(firstAppointmentByPatient).filter(
    (date) => date >= sixtyDaysAgo && date < thirtyDaysAgo
  ).length;

  const appointmentsPerPatient = uniquePatientsLast30
    ? appointmentsLast30.length / uniquePatientsLast30
    : 0;

  const churnBuckets = Object.values(lastAppointmentByPatient).reduce(
    (acc, date) => {
      if (date < sixtyDaysAgo) {
        acc.churned += 1;
      } else {
        acc.active += 1;
      }
      return acc;
    },
    { churned: 0, active: 0 }
  );

  const acceptedRows = leadCandidates.filter((row) => {
    const pid = getField(row, "patientId");
    return pid && acceptedIds.has(pid) && !rejectedIds.has(pid);
  });

  const bookingSourceCounts = aggregateBy(leadCandidates, "bookingSource", (value, row) => {
    const hc = getField(row, "leadSourceHc");
    return value || hc || "Unspecified";
  });

  const leadSourceCounts = aggregateBy(leadCandidates, "leadSource", (value, row) => {
    const hc = getField(row, "leadSourceHc");
    return hc || value || "Unspecified";
  });

  const upcomingBirthdays = computeUpcomingBirthdays(leadCandidates);
  const areaOptions = Array.from(new Set(leadCandidates.map((row) => normalizeText(getField(row, "area")) || "unspecified"))).filter(Boolean);
  const providerOptions = Object.keys(providerLabels);
  const leadSourceOptions = Array.from(
    new Set(
      leadCandidates.map((row) => normalizeText(getField(row, "bookingSource")) || normalizeText(getField(row, "leadSourceHc")) || normalizeText(getField(row, "leadSource"))).filter(Boolean)
    )
  );

  const numbersSummary = buildLeadAreaSummary(acceptedRows);
  const totalLeads = acceptedIds.size;
  const totalPendingPt = pendingIds.size;
  const totalInsuranceIssues = numbersSummary.reduce(
    (acc, row) => acc + row.insuranceIssues,
    0
  );
  const rejectedInsuranceCount = rejectedIds.size;

  const revenue = attendedLast30 * REVENUE_PER_VISIT;
  const growthPct = appointmentsPrev30.length
    ? (appointmentsLast30.length - appointmentsPrev30.length) / appointmentsPrev30.length
    : appointmentsLast30.length > 0
    ? 1
    : 0;
  const conversionRate = totalLeads ? (totalLeads - totalPendingPt) / totalLeads : 0;
  const churnRate =
    churnBuckets.active + churnBuckets.churned > 0
      ? churnBuckets.churned / (churnBuckets.active + churnBuckets.churned)
      : 0;
  const investorSnapshot = {
    revenue,
    revenuePerVisit: REVENUE_PER_VISIT,
    visitsLast30: appointmentsLast30.length,
    growthPct,
    conversionRate,
    churnRate,
    cancellationRate: totalAppointments ? cancelCount / totalAppointments : 0,
    attendance: attendanceLast30 || attendanceRate,
    activePatients: churnBuckets.active,
    churnedPatients: churnBuckets.churned,
    visitsPerPatient: appointmentsPerPatient,
  };

  const recommendations = buildRecommendations({
    numbersSummary,
    totals: {
      totalLeads,
      totalPendingPt,
      totalInsuranceIssues,
      attendanceLast30,
      attendancePrev30,
      cancelRate: totalAppointments ? cancelCount / totalAppointments : 0,
      docsPending,
    },
    areaDistribution,
    topPendingArea: numbersSummary
      .slice()
      .sort((a, b) => b.pendingPt - a.pendingPt)[0],
    topInsuranceArea: numbersSummary
      .slice()
      .sort((a, b) => b.insuranceIssues - a.insuranceIssues)[0],
    providerLeaders,
    appointmentsDelta: appointmentsLast30.length - appointmentsPrev30.length,
  });

  const analysisHighlights = buildAnalysisHighlights({
    providerLeaders,
    insuranceDistribution,
    totalLeads,
    numbersSummaryCount: numbersSummary.length,
    appointmentsLast30: appointmentsLast30.length,
    appointmentsPrev30: appointmentsPrev30.length,
    newPatientsLast30,
    cancelRate: totalAppointments ? cancelCount / totalAppointments : 0,
  });

  const upcomingAppointments = appointmentRecords
    .filter((record) => record.date >= now.startOf("day"))
    .sort((a, b) => a.date - b.date)
    .slice(0, 6);

  state.metrics = {
    summaryCards: [
      {
        title: "Patient Records",
        value: formatNumber(patientCount),
        subtitle: `${formatNumber(areaCount)} care zones`,
        trend: buildTrend(newPatientsLast30 - newPatientsPrev30, "new patients this month"),
      },
      {
        title: "Active Therapists",
        value: formatNumber(therapistCount),
        subtitle: "Engaged in patient caseload",
        trend: buildTrend(therapistCount ? therapistCount - 1 : 0, "net change vs last load"),
      },
      {
        title: "Appts (30 days)",
        value: formatNumber(appointmentsLast30.length),
        subtitle: `${formatNumber(uniquePatientsLast30)} patients touched`,
        trend: buildTrend(
          appointmentsLast30.length - appointmentsPrev30.length,
          "vs prior 30 days"
        ),
      },
      {
        title: "Attendance Rate",
        value: formatPercent(attendanceLast30 || attendanceRate),
        subtitle: `${formatNumber(attendedLast30 || totalAttended)} attended`,
        trend: buildTrend(
          attendanceLast30 - attendancePrev30,
          "change vs previous 30 days",
          true
        ),
      },
    {
      title: "Open Leads",
      value: formatNumber(totalLeads),
      subtitle: `${formatNumber(totalPendingPt)} pending PT assignment`,
      trend: buildTrend(
        totalLeads ? (totalPendingPt / totalLeads) * 100 : 0,
        "pending PT ratio",
        true,
        "%"
      ),
    },
    {
      title: "Unaccepted Insurance Leads",
      value: formatNumber(rejectedInsuranceCount),
      subtitle: "Patients with insurances we don’t accept",
      trend: buildTrend(
        rejectedInsuranceCount,
        "issues to audit",
        true,
        undefined,
        rejectedInsuranceCount > 0 ? "negative" : "neutral"
      ),
    },
  ],
    areaDistribution,
    insuranceDistribution,
    appointmentTrend,
    numbersSummary,
    upcomingAppointments,
    providerLeaders,
    patientProviders: Object.fromEntries(
      Object.entries(patientProviders).map(([key, value]) => [key, Array.from(value)])
    ),
    patientAppointmentTypes: Object.fromEntries(
      Object.entries(patientAppointmentTypes).map(([key, value]) => [key, Array.from(value)])
    ),
    providerLabels,
    recommendations,
    analysisHighlights,
    investorSnapshot,
    bookingSources: bookingSourceCounts,
    leadSources: leadSourceCounts,
    upcomingBirthdays,
    filterOptions: {
      areas: areaOptions,
      providers: providerOptions,
      leadSources: leadSourceOptions,
    },
    firstAppointmentByPatient: Object.fromEntries(
      Object.entries(firstAppointmentByPatient).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ])
    ),
    totals: {
      patients: patientCount,
      therapists: therapistCount,
      areas: areaCount,
      totalAppointments,
      totalLeads,
      totalPendingPt,
      totalInsuranceIssues,
      rejectedInsurance: rejectedInsuranceCount,
      attendanceRate,
      appointmentsPerPatient,
      newPatientsLast30,
      newPatientsPrev30,
      appointmentsLast30: appointmentsLast30.length,
      appointmentsPrev30: appointmentsPrev30.length,
      attendanceLast30,
      attendancePrev30,
      cancelCount,
      cancellationRate: totalAppointments ? cancelCount / totalAppointments : 0,
      docsPending,
      providerCount: uniqueProviderCount,
    },
  };
}

function buildLeadAreaSummary(patients) {
  if (!patients?.length) return [];
  const summary = patients.reduce((acc, row) => {
    const area = (getField(row, "area") || "Unspecified").trim() || "Unspecified";
    const bucket =
      acc[area] || { area, totalLeads: 0, pendingPt: 0, insuranceIssues: 0 };
    bucket.totalLeads += 1;
    if (isPendingLead(row)) {
      bucket.pendingPt += 1;
    }
    if (hasInsuranceIssue(row)) {
      bucket.insuranceIssues += 1;
    }
    acc[area] = bucket;
    return acc;
  }, {});
  return Object.values(summary).sort((a, b) => b.totalLeads - a.totalLeads);
}

function normalizeText(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function isPendingLead(row) {
  const assignedFlag = normalizeText(getField(row, "assignedFlag") ?? row?.Assigned);
  const assignedTo = normalizeText(getField(row, "assignedTo") ?? row?.["Assigned to"]);
  const status = normalizeText(getField(row, "status"));
  const readiness = normalizeText(row?.["Lead Readiness"] ?? row?.["lead readiness"]);

  const isAssigned =
    Boolean(assignedTo) ||
    /yes|y|true|1|assign|active|sched/.test(assignedFlag);
  const pendingStatusKeywords = [
    "pending",
    "await",
    "lead",
    "intake",
    "new",
    "prospect",
    "unassign",
  ];
  const readinessKeywords = ["pending", "follow", "need", "cold"];
  const flagged =
    pendingStatusKeywords.some((keyword) => status.includes(keyword)) ||
    readinessKeywords.some((keyword) => readiness.includes(keyword));

  return !isAssigned || flagged;
}

function hasInsuranceIssue(row) {
  const values = [
    getField(row, "insuranceStatus1"),
    getField(row, "insuranceStatus2"),
    getField(row, "insurance1"),
    getField(row, "insurance2"),
    row?.["Insurance Name 1"],
    row?.["Insurance 2"],
    row?.["Insurance 1 ID"],
    row?.["Insurance ID 2"],
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  const lostReason = normalizeText(getField(row, "lostReason"));
  if (lostReason.includes("insurance")) {
    return true;
  }

  const keywords = [
    "pending",
    "hold",
    "issue",
    "denied",
    "deny",
    "not",
    "inactive",
    "expired",
    "n/a",
    "none",
    "reject",
  ];

  return values.some((value) => keywords.some((keyword) => value.includes(keyword)));
}

function aggregateBy(rows, key, transformer) {
  const counts = {};
  rows.forEach((row) => {
    const rawValue = row[key] || "";
    const val = transformer ? transformer(rawValue, row) : rawValue;
    const finalKey = val || "Unspecified";
    counts[finalKey] = (counts[finalKey] || 0) + 1;
  });
  return Object.keys(counts)
    .sort()
    .map((label) => ({ label, value: counts[label] }));
}

function computeUpcomingBirthdays(rows) {
  const today = luxon.DateTime.now().startOf("day");
  const cutoff = today.plus({ days: 30 });
  return rows
    .map((row) => {
      const bday = parseDate(getField(row, "patientBirthday"));
      const name = `${row["First Name"] || ""} ${row["Last Name"] || ""}`.trim();
      if (!bday?.isValid) return null;
      let nextBirthday = bday.set({ year: today.year });
      if (nextBirthday < today) {
        nextBirthday = nextBirthday.plus({ years: 1 });
      }
      if (nextBirthday > cutoff) return null;
      return {
        patientId: getField(row, "patientId"),
        name: name || getField(row, "patientId"),
        label: nextBirthday.toFormat("MMM dd"),
        date: nextBirthday,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

function aggregateByWeek(records) {
  const grouped = records.reduce((acc, record) => {
    const week = record.date.startOf("week").toISODate();
    if (!acc[week]) {
      acc[week] = { week: record.date.startOf("week"), count: 0, attended: 0 };
    }
    acc[week].count += 1;
    if (["attended", "completed", "done"].some((keyword) => record.status.includes(keyword))) {
      acc[week].attended += 1;
    }
    return acc;
  }, {});

  return Object.values(grouped)
    .sort((a, b) => a.week - b.week)
    .slice(-12);
}

function buildTrend(delta, label, isPercentage = false, overrideUnit, forceDirection) {
  if (delta === undefined || delta === null) return null;
  if (Number.isNaN(delta)) return null;

  let direction = forceDirection || "neutral";
  if (!forceDirection) {
    if (delta > 0) direction = "positive";
    if (delta < 0) direction = "negative";
  }

  const absoluteDelta = Math.abs(delta);
  const formattedValue = isPercentage
    ? formatPercent(absoluteDelta)
    : overrideUnit === "%"
    ? `${absoluteDelta.toFixed(1)}%`
    : formatNumber(absoluteDelta);

  return {
    direction,
    label,
    value: delta === 0 ? "0" : `${delta > 0 ? "+" : "-"}${formattedValue}`,
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatPercent(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "0%";
  return `${(numeric * 100).toFixed(0)}%`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function buildRecommendations(context) {
  const {
    totals,
    topPendingArea,
    topInsuranceArea,
    providerLeaders,
    appointmentsDelta,
    areaDistribution,
  } = context;

  const recs = [];
  const pendingRatio =
    totals.totalLeads > 0 ? totals.totalPendingPt / totals.totalLeads : 0;

  if (topPendingArea?.pendingPt > 0) {
    recs.push(
      `Reassign PT bandwidth to ${topPendingArea.area} — ${formatNumber(
        topPendingArea.pendingPt
      )} leads are still waiting for coverage.`
    );
  }

  if (pendingRatio > 0.25) {
    recs.push(
      `Accelerate intake-to-PT handoff; ${formatPercent(
        pendingRatio
      )} of pipeline leads remain unassigned.`
    );
  }

  if (totals.totalInsuranceIssues > 0) {
    const focusArea = topInsuranceArea?.area || "priority territories";
    recs.push(
      `Coordinate with payer relations to resolve ${formatNumber(
        totals.totalInsuranceIssues
      )} insurance blocks (highest in ${focusArea}).`
    );
  }

  const attendancePercent =
    totals.attendanceLast30 || totals.attendanceRate || 0;
  if (attendancePercent > 0 && attendancePercent < 0.87) {
    recs.push(
      `Tighten reminder cadence — attendance is ${formatPercent(
        attendancePercent
      )} vs. goal ≥ 90%.`
    );
  }

  if (totals.cancelRate > 0.12) {
    recs.push(
      `Review cancellation causes; rate stands at ${formatPercent(
        totals.cancelRate
      )} this period.`
    );
  }

  if (totals.docsPending > 0) {
    recs.push(
      `Close out ${formatNumber(
        totals.docsPending
      )} documentation items to protect reimbursement timelines.`
    );
  }

  if (appointmentsDelta < 0) {
    recs.push(
      `Rebuild scheduling velocity — visits are down ${formatNumber(
        Math.abs(appointmentsDelta)
      )} vs. the prior 30 days.`
    );
  }

  if (
    providerLeaders.length > 1 &&
    providerLeaders[0].count >= providerLeaders[1].count * 1.6
  ) {
    recs.push(
      `Balance caseload: ${providerLeaders[0].provider} is carrying ${formatNumber(
        providerLeaders[0].count
      )} recent visits, far outpacing peers.`
    );
  }

  if (!recs.length && areaDistribution?.length) {
    recs.push(
      `Pipeline is stable; ${areaDistribution[0].name} holds the largest active census at ${formatNumber(
        areaDistribution[0].count
      )} patients.`
    );
  }

  return recs;
}

function buildAnalysisHighlights(context) {
  const {
    providerLeaders,
    insuranceDistribution,
    totalLeads,
    numbersSummaryCount,
    appointmentsLast30,
    appointmentsPrev30,
    newPatientsLast30,
    cancelRate,
  } = context;

  const highlights = [];

  if (providerLeaders.length) {
    highlights.push(
      `${providerLeaders[0].provider} is leading visit volume with ${formatNumber(
        providerLeaders[0].count
      )} encounters this quarter.`
    );
  }

  if (insuranceDistribution.length) {
    highlights.push(
      `${insuranceDistribution[0].name} remains the dominant payer across the active census.`
    );
  }

  if (numbersSummaryCount) {
    const avgLeads = totalLeads / numbersSummaryCount;
    highlights.push(
      `Average lead load per territory is ${formatNumber(
        avgLeads
      )}, guiding staffing benchmarks.`
    );
  }

  const visitDelta = appointmentsLast30 - appointmentsPrev30;
  if (visitDelta === 0) {
    highlights.push("Visit volume held flat compared to the prior month.");
  } else {
    highlights.push(
      `Visit volume ${visitDelta > 0 ? "grew" : "fell"} by ${formatNumber(
        Math.abs(visitDelta)
      )} compared to the prior month.`
    );
  }

  highlights.push(
    `New patient velocity is ${formatNumber(
      newPatientsLast30
    )} starts over the last 30 days.`
  );

  if (cancelRate > 0) {
    highlights.push(
      `Cancellation rate is running at ${formatPercent(
        cancelRate
      )}; continue tracking root causes.`
    );
  }

  return highlights;
}

function render() {
  if (!appEl) return;

  if (state.error) {
    appEl.innerHTML = renderError(state.error);
    return;
  }

  if (state.isLoading) {
    appEl.innerHTML = renderLoading();
    return;
  }

  appEl.innerHTML = `
    <div class="dashboard">
      ${renderHeader()}
      ${renderInvestorSnapshot()}
      ${renderSummary()}
      ${renderLeadInsights()}
      ${renderFooter()}
    </div>
  `;

  requestAnimationFrame(() => {
    attachEventHandlers();
    renderCharts();
    feather?.replace?.();
  });
}

function renderError(error) {
  return `
    <div class="error-banner">
      <i data-feather="alert-triangle"></i>
      <div>
        <strong>We hit a snag while loading the dashboard.</strong>
        <div>${error?.message || error}</div>
      </div>
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="empty-state">
      <i data-feather="loader" class="spin"></i>
      <div>Fetching live data from Google Sheets...</div>
    </div>
  `;
}

function renderHeader() {
  const updatedLabel = state.lastUpdated
    ? `Updated ${luxon.DateTime.fromJSDate(state.lastUpdated).toRelative({ base: luxon.DateTime.now() })}`
    : "Loading data";

  return `
    <header class="header">
      <div class="top-bar">
        <div class="branding">
          <div class="brand-icon" aria-hidden="true">
            <i data-feather="activity"></i>
          </div>
          <div class="brand-meta">
            <h1>City Rehab Home Care Intelligence</h1>
            <p>Central command for patient pipeline, scheduling cadence, and insurance readiness.</p>
          </div>
        </div>
        <div class="controls">
          <button class="primary" data-action="refresh">
            <i data-feather="rotate-cw"></i>
            Refresh Data
          </button>
          <button data-action="export">
            <i data-feather="download-cloud"></i>
            Export Snapshot
          </button>
          <span class="last-updated">
            <i data-feather="clock"></i>
            ${updatedLabel}
          </span>
        </div>
      </div>
    </header>
  `;
}

function renderInvestorSnapshot() {
  const snap = state.metrics.investorSnapshot || {};
  const options = state.metrics.filterOptions || {};
  const cards = [
    {
      label: "Revenue (30d est.)",
      value: formatCurrency(snap.revenue),
      detail: `~${formatCurrency(snap.revenuePerVisit)}/visit`,
      tone: "primary",
    },
    {
      label: "Visit Growth",
      value: formatPercent(snap.growthPct),
      detail: "vs prior 30d",
      tone: snap.growthPct >= 0 ? "positive" : "negative",
    },
    {
      label: "Pipeline Conversion",
      value: formatPercent(snap.conversionRate),
      detail: "Assigned vs total accepted leads",
      tone: snap.conversionRate >= 0.6 ? "positive" : "neutral",
    },
    {
      label: "Churn Proxy",
      value: formatPercent(snap.churnRate),
      detail: `${formatNumber(snap.churnedPatients || 0)} inactive >60d`,
      tone: snap.churnRate <= 0.15 ? "positive" : "negative",
    },
    {
      label: "Cancellation Rate",
      value: formatPercent(snap.cancellationRate),
      detail: "30/60d blended",
      tone: snap.cancellationRate <= 0.12 ? "positive" : "negative",
    },
    {
      label: "Attendance",
      value: formatPercent(snap.attendance),
      detail: "Attended / booked",
      tone: snap.attendance >= 0.9 ? "positive" : "neutral",
    },
    {
      label: "Active Patients",
      value: formatNumber(snap.activePatients || 0),
      detail: `${formatNumber(snap.visitsPerPatient || 0)} visits per patient (avg)`,
      tone: "neutral",
    },
  ];

  const cardHtml = cards
    .map(
      (card) => `
        <article class="investor-card ${card.tone || ""}">
          <div class="investor-label">${card.label}</div>
          <div class="investor-value">${card.value}</div>
          <div class="investor-detail">${card.detail}</div>
        </article>
      `
    )
    .join("");

  return `
    <section class="panel panel-compact">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Investor Snapshot</h2>
          <span>Growth, revenue, and risk signals for shareholders</span>
        </div>
        <div class="panel-actions">
          <select class="filter" data-filter="area">
            ${renderFilterOptions(options.areas || [], state.filters.area, "Area")}
          </select>
          <select class="filter" data-filter="provider">
            ${renderFilterOptions(options.providers || [], state.filters.provider, "Provider")}
          </select>
          <select class="filter" data-filter="leadSource">
            ${renderFilterOptions(options.leadSources || [], state.filters.leadSource, "Lead source")}
          </select>
          <label class="date-filter-label">From
            <input type="date" class="filter date-filter" data-filter="metricsStart" value="${state.filters.metricsStart || ""}" />
          </label>
          <label class="date-filter-label">To
            <input type="date" class="filter date-filter" data-filter="metricsEnd" value="${state.filters.metricsEnd || ""}" />
          </label>
        </div>
      </div>
      <div class="investor-grid">
        ${cardHtml}
      </div>
    </section>
  `;
}

function renderSummary() {
  const cards = state.metrics.summaryCards
    .map((card) => {
      const trend =
        card.trend && card.trend.value !== "0"
          ? `<div class="summary-trend ${card.trend.direction}">
              <i data-feather="${
                card.trend.direction === "positive"
                  ? "arrow-up-right"
                  : card.trend.direction === "negative"
                  ? "arrow-down-right"
                  : "minus"
              }"></i>
              ${card.trend.value}
              <span>${card.trend.label}</span>
            </div>`
          : "";
      return `
        <article class="summary-card">
          <h3>${card.title}</h3>
          <strong>${card.value}</strong>
          <span>${card.subtitle}</span>
          ${trend}
        </article>
      `;
    })
    .join("");

  return `<section class="summary-grid">${cards}</section>`;
}

function renderLeadInsights() {
  const numbersSummary = state.metrics.numbersSummary || [];
  const totals = state.metrics.totals || {};
  const providerHighlights = (state.metrics.providerLeaders || []).slice(0, 3);
  const pendingRanking = numbersSummary
    .slice()
    .sort((a, b) => b.pendingPt - a.pendingPt)
    .slice(0, 3);

  const insuranceHighlights = state.metrics.insuranceDistribution
    .map(
      (item) => `
        <div class="trend-item">
          <strong>${item.name}</strong>
          <span>${formatNumber(item.count)} patients</span>
        </div>
      `
    )
    .join("");

  const topBooking = (state.metrics.bookingSources || [])
    .slice()
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 5)
    .map(
      (item) => `
        <div class="trend-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${formatNumber(item.value)}</strong>
        </div>
      `
    )
    .join("");

  const topLeadSources = (state.metrics.leadSources || [])
    .slice()
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 5)
    .map(
      (item) => `
        <div class="trend-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${formatNumber(item.value)}</strong>
        </div>
      `
    )
    .join("");

  const pendingList = pendingRanking
    .map(
      (item) => `
        <div class="trend-item">
          <span>${item.area}</span>
          <div class="trend-chip negative">
            <i data-feather="alert-circle"></i>
            ${formatNumber(item.pendingPt)}
          </div>
        </div>
      `
    )
    .join("");

  const metricCards = [
    {
      label: "Total Leads",
      value: formatNumber(totals.totalLeads),
      detail: `${formatNumber(numbersSummary.length)} territories`,
      tone: "positive",
    },
    {
      label: "Pending PT",
      value: formatNumber(totals.totalPendingPt),
      detail: `${formatPercent(
        totals.totalLeads ? totals.totalPendingPt / totals.totalLeads : 0
      )} of pipeline`,
      tone: totals.totalPendingPt > 0 ? "negative" : "positive",
    },
    {
      label: "Unaccepted Insurance Leads",
      value: formatNumber(totals.rejectedInsurance),
      detail: "Leads blocked by payer",
      tone: totals.rejectedInsurance > 0 ? "negative" : "positive",
    },
    {
      label: "Attendance (30d)",
      value: formatPercent(totals.attendanceLast30 || totals.attendanceRate),
      detail: `Prev ${formatPercent(
        totals.attendancePrev30 || totals.attendanceRate
      )}`,
      tone:
        (totals.attendanceLast30 || totals.attendanceRate) >= 0.9
          ? "positive"
          : "neutral",
    },
    {
      label: "Cancellation Rate",
      value: formatPercent(totals.cancellationRate),
      detail: `${formatNumber(totals.cancelCount)} cancellations`,
      tone: totals.cancellationRate > 0.12 ? "negative" : "neutral",
    },
    {
      label: "New Patients (30d)",
      value: formatNumber(totals.newPatientsLast30),
      detail: `${formatNumber(
        totals.newPatientsLast30 - (totals.newPatientsPrev30 || 0)
      )} vs prior`,
      tone:
        totals.newPatientsLast30 >= (totals.newPatientsPrev30 || 0)
          ? "positive"
          : "neutral",
    },
    {
      label: "Providers Active",
      value: formatNumber(totals.providerCount),
      detail: providerHighlights[0]
        ? `Top: ${providerHighlights[0].provider}`
        : "No visits logged",
      tone: "neutral",
    },
    {
      label: "Docs Pending",
      value: formatNumber(totals.docsPending),
      detail: "Note completion",
      tone: totals.docsPending > 0 ? "negative" : "positive",
    },
  ]
    .map(
      (metric) => `
        <div class="metric-card ${metric.tone}">
          <span>${metric.label}</span>
          <strong>${metric.value}</strong>
          <em>${metric.detail}</em>
        </div>
      `
    )
    .join("");

  return `
    <section class="layout-two-col layout-two-col--wide">
      <article class="panel panel-xl">
        <div class="panel-header">
          <div class="panel-title">
            <h2>Lead & Territory Coverage</h2>
            <span>Live distribution from PatientData + PT schedule tabs</span>
          </div>
          <div class="panel-actions">
            <select class="filter" data-filter="area">
              ${renderFilterOptions((state.metrics.filterOptions?.areas || []), state.filters.area, "Area")}
            </select>
            <select class="filter" data-filter="provider">
              ${renderFilterOptions((state.metrics.filterOptions?.providers || []), state.filters.provider, "Provider")}
            </select>
            <select class="filter" data-filter="leadSource">
              ${renderFilterOptions((state.metrics.filterOptions?.leadSources || []), state.filters.leadSource, "Lead source")}
            </select>
            <span class="chip">
              <i data-feather="map-pin"></i>
              ${formatNumber(state.metrics.totals.areas)} areas
            </span>
          </div>
        </div>
        <div class="chart-grid chart-grid--double">
          <div class="chart-card">
            <h3>
              <i data-feather="bar-chart-2"></i>
              Leads by Area
            </h3>
            <canvas id="leadsByArea"></canvas>
          </div>
          <div class="chart-card">
            <h3>
              <i data-feather="trending-up"></i>
              Booking & Lead Sources
            </h3>
            <canvas id="bookingSourceChart"></canvas>
          </div>
        </div>
        <div class="insight-grid">
          <div class="insight-card">
            <strong>Pending PT Watchlist</strong>
            <div class="trend-list">
              ${pendingList || "<span>All territories are within SLA.</span>"}
            </div>
          </div>
        <div class="insight-card">
          <strong>Top Booking Sources</strong>
          <div class="trend-list">
            ${topBooking || "<span>No booking source data.</span>"}
          </div>
        </div>
        <div class="insight-card">
          <strong>Top HC Lead Sources</strong>
          <div class="trend-list">
            ${topLeadSources || "<span>No lead source data.</span>"}
          </div>
        </div>
        <div class="insight-card">
            <strong>Upcoming Birthdays (30d)</strong>
            <div class="trend-list">
              ${
                (state.metrics.upcomingBirthdays || [])
                  .slice(0, 5)
                  .map(
                    (item) => `
                      <div class="trend-item">
                        <span>${escapeHtml(item.name || item.patientId || "Unknown")}</span>
                        <strong>${escapeHtml(item.label || "")}</strong>
                      </div>
                    `
                  )
                  .join("") || "<span>No upcoming birthdays.</span>"
              }
            </div>
          </div>
        </div>
      </article>
    </section>
  `;
}

function renderRecommendationsSection() {
  const recommendations = state.metrics.recommendations || [];
  const analysis = state.metrics.analysisHighlights || [];

  const recommendationsHtml = recommendations.length
    ? recommendations
        .map((item) => `<li><i data-feather="target"></i>${escapeHtml(item)}</li>`)
        .join("")
    : '<li><i data-feather="check-circle"></i>Pipeline is healthy. Keep monitoring key metrics weekly.</li>';

  const analysisHtml = analysis.length
    ? analysis
        .map((item) => `<li><i data-feather="trending-up"></i>${escapeHtml(item)}</li>`)
        .join("")
    : '<li><i data-feather="info"></i>No additional insights available.</li>';

  return `
    <section class="panel panel-analysis">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Guided Actions & Insights</h2>
          <span>Auto-generated recommendations based on current operational data</span>
        </div>
      </div>
      <div class="analysis-grid">
        <div class="analysis-column">
          <h3>Key Recommendations</h3>
          <ul class="analysis-list">
            ${recommendationsHtml}
          </ul>
        </div>
        <div class="analysis-column">
          <h3>Operational Highlights</h3>
          <ul class="analysis-list">
            ${analysisHtml}
          </ul>
        </div>
      </div>
    </section>
  `;
}

function renderAppointmentsPanel() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Scheduling Velocity</h2>
          <span>Rolling 12-week view sourced from all PT appointment sheets</span>
        </div>
        <div class="panel-actions">
          <span class="chip">
            <i data-feather="check-circle"></i>
            ${formatPercent(
              state.metrics.totals.attendanceLast30 || state.metrics.totals.attendanceRate
            )} attendance (30d)
          </span>
          <span class="chip">
            <i data-feather="users"></i>
            ${formatNumber(state.metrics.totals.newPatientsLast30)} new patients (30d)
          </span>
          <span class="chip">
            <i data-feather="slash"></i>
            ${formatPercent(state.metrics.totals.cancellationRate)} cancellations
          </span>
          <span class="chip">
            <i data-feather="clipboard"></i>
            ${formatNumber(state.metrics.totals.docsPending)} docs pending
          </span>
        </div>
      </div>
      <div class="chart-card">
        <canvas id="appointmentsTrend"></canvas>
      </div>
    </section>
  `;
}

function renderPatientDirectory() {
  const filteredRows = filterPatients();

  return `
    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Patient Directory</h2>
          <span>Interactive data grid synced live with PatientData sheet headers</span>
        </div>
        <div class="panel-actions">
          <span class="chip">
            ${formatNumber(filteredRows.length)} of ${formatNumber(state.data.patients.length)} listings
          </span>
        </div>
      </div>
      ${renderFilters()}
      <div class="table-wrapper">
        <div class="table-container">
          ${renderPatientTable(filteredRows)}
        </div>
      </div>
    </section>
  `;
}

function filterPatients() {
  const {
    area,
    status,
    therapist,
    insurance,
    leadSource,
    bookingSource,
    authorization,
    patientId,
    provider,
    appointmentType,
    dateStart,
    dateEnd,
    search,
  } = state.filters;

  const normalizedSearch = search.trim().toLowerCase();
  const firstAppointments = state.metrics.firstAppointmentByPatient || {};
  const patientProviders = state.metrics.patientProviders || {};
  const patientAppointmentTypes = state.metrics.patientAppointmentTypes || {};

  const startDate = dateStart ? luxon.DateTime.fromISO(dateStart) : null;
  const endDate = dateEnd ? luxon.DateTime.fromISO(dateEnd) : null;
  const startBoundary = startDate?.isValid ? startDate.startOf("day") : null;
  const endBoundary = endDate?.isValid ? endDate.endOf("day") : null;

  return state.data.patients.filter((row) => {
    const rowArea = (getField(row, "area") || "").toLowerCase();
    const rowStatus = (getField(row, "status") || "").toLowerCase();
    const rowTherapist = (getField(row, "therapist") || "").toLowerCase();
    const rowInsurance =
      ((getField(row, "insurance1") || "") +
        " " +
        (getField(row, "insuranceStatus1") || "")).toLowerCase();
    const rowLeadSource = (getField(row, "leadSource") || "").toLowerCase();
    const rowBookingSource = (getField(row, "bookingSource") || "").toLowerCase();
    const rowAuthorization = (getField(row, "authorization") || "").toLowerCase();
    const id = (getField(row, "patientId") || "").toLowerCase();

    if (area !== "all" && rowArea !== area) return false;
    if (status !== "all" && rowStatus !== status) return false;
    if (therapist !== "all" && !rowTherapist.includes(therapist)) return false;
    if (insurance !== "all" && !rowInsurance.includes(insurance)) return false;
    if (leadSource !== "all" && rowLeadSource !== leadSource) return false;
    if (bookingSource !== "all" && rowBookingSource !== bookingSource) return false;
    if (authorization !== "all" && rowAuthorization !== authorization) return false;
    if (patientId !== "all" && id !== patientId) return false;

    const providersForPatient = patientProviders[id] || [];
    if (provider !== "all" && !providersForPatient.includes(provider)) {
      return false;
    }

    const typesForPatient = patientAppointmentTypes[id] || [];
    if (appointmentType !== "all" && !typesForPatient.includes(appointmentType)) {
      return false;
    }

    if (startBoundary || endBoundary) {
      const firstAppt = firstAppointments[id];
      if (!firstAppt) return false;
      if (startBoundary && firstAppt < startBoundary) return false;
      if (endBoundary && firstAppt > endBoundary) return false;
    }

    if (normalizedSearch) {
      const rowString = Object.values(row).join(" ").toLowerCase();
      if (!rowString.includes(normalizedSearch)) return false;
    }

    return true;
  });
}

function renderFilters() {
  const uniqueAreas = Array.from(
    new Set(
      state.data.patients
        .map((row) => (getField(row, "area") || "").trim())
        .filter((value) => value)
    )
  ).sort();

  const uniqueStatuses = Array.from(
    new Set(
      state.data.patients
        .map((row) => (getField(row, "status") || "").trim())
        .filter((value) => value)
    )
  ).sort();

  const uniqueTherapists = Array.from(
    new Set(
      state.data.patients
        .flatMap((row) => (getField(row, "therapist") || "").split(","))
        .map((value) => value.trim())
        .filter((value) => value)
    )
  ).sort();

  const uniqueInsuranceStatus = Array.from(
    new Set(
      state.data.patients
        .map(
          (row) =>
            (getField(row, "insuranceStatus1") || "") +
            " " +
            (getField(row, "insurance1") || "")
        )
        .map((value) => value.trim())
        .filter((value) => value)
    )
  ).sort();

  const uniqueLeadSources = Array.from(
    new Set(
      state.data.patients
        .map((row) => (getField(row, "leadSource") || "").trim())
        .filter((value) => value)
    )
  ).sort();

  const uniqueBookingSources = Array.from(
    new Set(
      state.data.patients
        .map((row) => (getField(row, "bookingSource") || "").trim())
        .filter((value) => value)
    )
  ).sort();

  const uniqueAuthorization = Array.from(
    new Set(
      state.data.patients
        .map((row) => (getField(row, "authorization") || "").trim())
        .filter((value) => value)
    )
  ).sort();

  const uniquePatients = Array.from(
    new Set(
      state.data.patients
        .map((row) => (getField(row, "patientId") || "").trim())
        .filter((value) => value)
    )
  ).sort();

  const providerOptions = Object.entries(state.metrics.providerLabels || {}).map(
    ([value, label]) => ({
      value,
      label,
    })
  );

  const appointmentTypeOptions = Array.from(
    new Set(
      Object.values(state.metrics.patientAppointmentTypes || {})
        .flat()
        .filter((value) => value)
    )
  )
    .sort()
    .map((value) => ({
      value,
      label: value.replace(/\b\w/g, (char) => char.toUpperCase()),
    }));

  const formatLabel = (value) =>
    value
      .split(/[\s_/]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const renderOptions = (options, selected) => {
    const normalized = options
      .map((option) => {
        if (!option && option !== 0) return null;
        if (typeof option === "object" && option !== null) {
          const optValue =
            option.value !== undefined ? String(option.value) : String(option.label ?? "");
          const optLabel =
            option.label !== undefined ? String(option.label) : String(option.value ?? "");
          return { value: optValue, label: optLabel };
        }
        const raw = String(option);
        return { value: raw, label: raw };
      })
      .filter((item) => item && item.value);

    return ['<option value="all">All</option>']
      .concat(
        normalized.map(({ value, label }) => {
          const normalizedValue = value.toLowerCase();
          const isSelected = selected === normalizedValue ? "selected" : "";
          return `<option value="${escapeHtml(normalizedValue)}" ${isSelected}>${escapeHtml(
            label
          )}</option>`;
        })
      )
      .join("");
  };

  return `
    <div class="filters">
      <div class="filters-row">
        <div class="filter-group">
          <label for="filter-area">Area</label>
          <select id="filter-area" class="filter" data-filter="area">
            ${renderOptions(uniqueAreas, state.filters.area)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-status">Status</label>
          <select id="filter-status" class="filter" data-filter="status">
            ${renderOptions(uniqueStatuses, state.filters.status)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-therapist">PT / Therapist</label>
          <select id="filter-therapist" class="filter" data-filter="therapist">
            ${renderOptions(uniqueTherapists, state.filters.therapist)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-provider">Assigned Provider</label>
          <select id="filter-provider" class="filter" data-filter="provider">
            ${renderOptions(providerOptions, state.filters.provider)}
          </select>
        </div>
        <div class="filter-group filter-group--grow">
          <label for="filter-search">Search</label>
          <input
            id="filter-search"
            type="search"
            class="filter"
            data-filter="search"
            placeholder="Search patients, referrals, insurance..."
            value="${escapeHtml(state.filters.search)}"
          />
        </div>
      </div>
      <div class="filters-row">
        <div class="filter-group">
          <label for="filter-insurance">Insurance Status</label>
          <select id="filter-insurance" class="filter" data-filter="insurance">
            ${renderOptions(uniqueInsuranceStatus, state.filters.insurance)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-lead">Lead Source</label>
          <select id="filter-lead" class="filter" data-filter="leadSource">
            ${renderOptions(
              uniqueLeadSources.map((value) => ({
                value,
                label: formatLabel(value),
              })),
              state.filters.leadSource
            )}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-booking">Booking Source</label>
          <select id="filter-booking" class="filter" data-filter="bookingSource">
            ${renderOptions(
              uniqueBookingSources.map((value) => ({
                value,
                label: formatLabel(value),
              })),
              state.filters.bookingSource
            )}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-authorization">Authorization</label>
          <select id="filter-authorization" class="filter" data-filter="authorization">
            ${renderOptions(
              uniqueAuthorization.map((value) => ({
                value,
                label: formatLabel(value),
              })),
              state.filters.authorization
            )}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-patient">Patient</label>
          <select id="filter-patient" class="filter" data-filter="patientId">
            ${renderOptions(
              uniquePatients.map((id) => ({ value: id.toLowerCase(), label: id })),
              state.filters.patientId
            )}
          </select>
        </div>
      </div>
      <div class="filters-row">
        <div class="filter-group">
          <label for="filter-appointment-type">Appointment Type</label>
          <select id="filter-appointment-type" class="filter" data-filter="appointmentType">
            ${renderOptions(appointmentTypeOptions, state.filters.appointmentType)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-date-start">First Visit From</label>
          <input
            id="filter-date-start"
            type="date"
            class="filter"
            data-filter="dateStart"
            value="${state.filters.dateStart || ""}"
          />
        </div>
        <div class="filter-group">
          <label for="filter-date-end">First Visit To</label>
          <input
            id="filter-date-end"
            type="date"
            class="filter"
            data-filter="dateEnd"
            value="${state.filters.dateEnd || ""}"
          />
        </div>
      </div>
    </div>
  `;
}

function renderPatientTable(rows) {
  const headers = state.headers.patients;
  if (!headers?.length) {
    return `
      <div class="empty-state">
        <i data-feather="database"></i>
        <div>No columns detected in the PatientData sheet.</div>
      </div>
    `;
  }

  const headerRow = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const bodyRows = rows
    .map((row) => {
      const cells = headers
        .map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr>${headerRow}</tr>
      </thead>
      <tbody>
        ${bodyRows || `<tr><td colspan="${headers.length}">No patients match these filters.</td></tr>`}
      </tbody>
    </table>
  `;
}

function renderFooter() {
  return `
    <footer class="footer">
      <span>Powered by live Google Sheets data.</span>
      <span>City Rehab · ${luxon.DateTime.now().toFormat("MMMM yyyy")}</span>
    </footer>
  `;
}

function attachEventHandlers() {
  const refreshButton = appEl.querySelector('[data-action="refresh"]');
  refreshButton?.addEventListener("click", async () => {
    state.isLoading = true;
    render();
    MATCH_CACHE.clear();
    try {
      await loadAllData();
      state.lastUpdated = new Date();
      computeMetrics();
      state.isLoading = false;
      state.error = null;
      render();
    } catch (error) {
      console.error(error);
      state.error = error;
      state.isLoading = false;
      render();
    }
  });

  const exportButton = appEl.querySelector('[data-action="export"]');
  exportButton?.addEventListener("click", () => {
    downloadSnapshot();
  });

  const filterElements = appEl.querySelectorAll(".filter");
    filterElements.forEach((element) => {
      element.addEventListener("input", (event) => {
        const target = event.target;
        const key = target.dataset.filter;
        if (!key) return;
        let value = target.value ?? "";
        const caseSensitiveKeys = ["search", "dateStart", "dateEnd", "metricsStart", "metricsEnd"];
        if (!caseSensitiveKeys.includes(key)) {
          value = value.toLowerCase();
        }
        state.filters = { ...state.filters, [key]: value };
        if (!state.isLoading && !state.error) {
          computeMetrics();
        }
        render();
      });
  });
}

function renderCharts() {
  renderLeadsByArea();
  renderBookingSources();
  renderAppointmentsTrend();
}

function renderLeadsByArea() {
  const ctx = document.getElementById("leadsByArea");
  if (!ctx) return;

  state.charts.leadsByArea?.destroy();

  const labels = state.metrics.numbersSummary.map((row) => row.area);
  const dataset = state.metrics.numbersSummary.map((row) => row.totalLeads);
  const pending = state.metrics.numbersSummary.map((row) => row.pendingPt);

  state.charts.leadsByArea = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Leads",
          data: dataset,
          backgroundColor: "rgba(56, 189, 248, 0.6)",
          borderRadius: 12,
          borderSkipped: false,
        },
        {
          label: "Pending PT",
          data: pending,
          backgroundColor: "rgba(244, 114, 182, 0.5)",
          borderRadius: 12,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: "#475569" },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#475569", precision: 0 },
          grid: { color: "rgba(148, 163, 184, 0.1)" },
        },
      },
      plugins: {
        legend: {
          labels: { color: "#475569" },
        },
      },
    },
  });
}

function renderBookingSources() {
  const ctx = document.getElementById("bookingSourceChart");
  if (!ctx) return;
  state.charts.bookingSourceChart?.destroy();

  const booking = state.metrics.bookingSources || [];
  const lead = state.metrics.leadSources || [];
  const labels = Array.from(
    new Set([...booking.map((b) => b.label), ...lead.map((l) => l.label)])
  );
  const bookingMap = Object.fromEntries(booking.map((b) => [b.label, b.value]));
  const leadMap = Object.fromEntries(lead.map((l) => [l.label, l.value]));

  state.charts.bookingSourceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Booking Source",
          data: labels.map((l) => bookingMap[l] || 0),
          backgroundColor: "rgba(15, 109, 236, 0.6)",
        },
        {
          label: "HC Source of Lead",
          data: labels.map((l) => leadMap[l] || 0),
          backgroundColor: "rgba(31, 178, 138, 0.6)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: "#475569" },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#475569", precision: 0 },
          grid: { color: "rgba(148, 163, 184, 0.1)" },
        },
      },
      plugins: {
        legend: {
          labels: { color: "#475569" },
        },
      },
    },
  });
}

function renderAppointmentsTrend() {
  const ctx = document.getElementById("appointmentsTrend");
  if (!ctx) return;

  state.charts.appointmentsTrend?.destroy();

  const labels = state.metrics.appointmentTrend.map((item) =>
    item.week.toFormat("MMM dd")
  );
  const dataset = state.metrics.appointmentTrend.map((item) => item.count);
  const attendedDataset = state.metrics.appointmentTrend.map((item) => item.attended);

  state.charts.appointmentsTrend = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Booked",
          data: dataset,
          borderColor: "rgba(56, 189, 248, 0.8)",
          backgroundColor: "rgba(56, 189, 248, 0.2)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
        },
        {
          label: "Attended",
          data: attendedDataset,
          borderColor: "rgba(52, 211, 153, 0.85)",
          backgroundColor: "rgba(52, 211, 153, 0.15)",
          fill: true,
          tension: 0.35,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: "#475569" },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#475569", precision: 0 },
          grid: { color: "rgba(148, 163, 184, 0.1)" },
        },
      },
      plugins: {
        legend: {
          labels: { color: "#475569" },
        },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
    },
  });
}

function generateColorPalette(count) {
  const palette = [
    "rgba(56, 189, 248, 0.8)",
    "rgba(244, 114, 182, 0.8)",
    "rgba(248, 180, 0, 0.8)",
    "rgba(52, 211, 153, 0.8)",
    "rgba(129, 140, 248, 0.8)",
    "rgba(248, 113, 113, 0.8)",
    "rgba(190, 242, 100, 0.8)",
  ];
  if (count <= palette.length) return palette.slice(0, count);
  const extended = [];
  for (let i = 0; i < count; i += 1) {
    extended.push(palette[i % palette.length]);
  }
  return extended;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function downloadSnapshot() {
  const payload = {
    exportedAt: new Date().toISOString(),
    metrics: state.metrics,
    filters: state.filters,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `city-rehab-dashboard-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

bootstrap();
function renderFilterOptions(options, selected, placeholder) {
  const normalized = (options || []).map((opt) => ({
    value: typeof opt === "string" ? opt : opt?.value,
    label: typeof opt === "string" ? opt : opt?.label,
  }));
  const sel = selected || "all";
  const opts = ['<option value="all">All</option>'].concat(
    normalized
      .filter((o) => o.value)
      .map(
        (o) =>
          `<option value="${escapeHtml(o.value)}" ${
            sel === o.value ? "selected" : ""
          }>${escapeHtml(o.label || o.value)}</option>`
      )
  );
  return opts.join("");
}
