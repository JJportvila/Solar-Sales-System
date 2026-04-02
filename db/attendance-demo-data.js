function getBusinessDateKey(timeZone = "Pacific/Efate", now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(now).reduce((acc, item) => {
    acc[item.type] = item.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function buildIsoAtBusinessDate(dateKey = "", time = "09:00:00", offset = "+11:00") {
  return `${dateKey}T${time}${offset}`;
}

function buildDemoAttendanceData({ timeZone = "Pacific/Efate", dateKey, utcOffset = "+11:00" } = {}) {
  const businessDate = String(dateKey || getBusinessDateKey(timeZone)).trim();

  const checkins = [
    {
      id: `demo-chk-in-eng-001-${businessDate}`,
      userId: "emp-eng-001",
      action: "in",
      lat: -17.74615,
      lng: 168.3142,
      accuracy: 9,
      note: "总部仓库出发，开始今日外勤",
      ts: buildIsoAtBusinessDate(businessDate, "08:34:00", utcOffset),
      date: businessDate
    },
    {
      id: `demo-chk-out-eng-001-${businessDate}`,
      userId: "emp-eng-001",
      action: "out",
      lat: -17.72144,
      lng: 168.32581,
      accuracy: 12,
      note: "完成维修后返回 Port Vila",
      ts: buildIsoAtBusinessDate(businessDate, "17:48:00", utcOffset),
      date: businessDate
    },
    {
      id: `demo-chk-in-sales-001-${businessDate}`,
      userId: "emp-sales-001",
      action: "in",
      lat: -17.73492,
      lng: 168.31744,
      accuracy: 7,
      note: "上午门店巡访开始",
      ts: buildIsoAtBusinessDate(businessDate, "08:52:00", utcOffset),
      date: businessDate
    },
    {
      id: `demo-chk-out-sales-001-${businessDate}`,
      userId: "emp-sales-001",
      action: "out",
      lat: -17.74183,
      lng: 168.32948,
      accuracy: 10,
      note: "提交客户跟进后签退",
      ts: buildIsoAtBusinessDate(businessDate, "17:12:00", utcOffset),
      date: businessDate
    },
    {
      id: `demo-chk-in-mgr-001-${businessDate}`,
      userId: "emp-sales-mgr-001",
      action: "in",
      lat: -17.73956,
      lng: 168.32161,
      accuracy: 8,
      note: "总部晨会后开始现场巡检",
      ts: buildIsoAtBusinessDate(businessDate, "08:41:00", utcOffset),
      date: businessDate
    }
  ];

  const visits = [
    {
      id: `demo-visit-emae-${businessDate}`,
      userId: "emp-eng-001",
      customer: "Emae Village Center",
      note: "检查逆变器告警，确认电池线缆压接正常。",
      lat: -17.73758,
      lng: 168.32092,
      accuracy: 11,
      address: "Port Vila feeder depot, Efate",
      audioUrl: "",
      photoUrls: [],
      recordedAt: buildIsoAtBusinessDate(businessDate, "10:12:00", utcOffset)
    },
    {
      id: `demo-visit-wharf-${businessDate}`,
      userId: "emp-sales-001",
      customer: "Port Vila Solar Mart",
      note: "和门店核对批发补货数量，已确认 2 套 M-BOX1200。",
      lat: -17.73991,
      lng: 168.32784,
      accuracy: 8,
      address: "Port Vila town center",
      audioUrl: "",
      photoUrls: [],
      recordedAt: buildIsoAtBusinessDate(businessDate, "11:06:00", utcOffset)
    },
    {
      id: `demo-visit-hq-${businessDate}`,
      userId: "emp-sales-mgr-001",
      customer: "Port Vila Headquarters",
      note: "复盘签到纪律和外勤覆盖率，抽查 GPS 采点。",
      lat: -17.73812,
      lng: 168.31976,
      accuracy: 6,
      address: "Port Vila HQ",
      audioUrl: "",
      photoUrls: [],
      recordedAt: buildIsoAtBusinessDate(businessDate, "14:18:00", utcOffset)
    }
  ];

  const tracks = [
    {
      id: `demo-track-eng-001-${businessDate}`,
      userId: "emp-eng-001",
      date: businessDate,
      startedAt: buildIsoAtBusinessDate(businessDate, "08:36:00", utcOffset),
      endedAt: buildIsoAtBusinessDate(businessDate, "12:04:00", utcOffset),
      points: [
        { lat: -17.74615, lng: 168.3142, accuracy: 9, ts: buildIsoAtBusinessDate(businessDate, "08:36:00", utcOffset) },
        { lat: -17.74482, lng: 168.31566, accuracy: 10, ts: buildIsoAtBusinessDate(businessDate, "08:52:00", utcOffset) },
        { lat: -17.74295, lng: 168.31794, accuracy: 8, ts: buildIsoAtBusinessDate(businessDate, "09:11:00", utcOffset) },
        { lat: -17.74034, lng: 168.31987, accuracy: 7, ts: buildIsoAtBusinessDate(businessDate, "09:33:00", utcOffset) },
        { lat: -17.73758, lng: 168.32092, accuracy: 11, ts: buildIsoAtBusinessDate(businessDate, "10:12:00", utcOffset) },
        { lat: -17.73491, lng: 168.32246, accuracy: 9, ts: buildIsoAtBusinessDate(businessDate, "10:48:00", utcOffset) },
        { lat: -17.73077, lng: 168.32408, accuracy: 13, ts: buildIsoAtBusinessDate(businessDate, "11:19:00", utcOffset) },
        { lat: -17.72634, lng: 168.32514, accuracy: 12, ts: buildIsoAtBusinessDate(businessDate, "11:46:00", utcOffset) }
      ]
    },
    {
      id: `demo-track-sales-001-${businessDate}`,
      userId: "emp-sales-001",
      date: businessDate,
      startedAt: buildIsoAtBusinessDate(businessDate, "08:58:00", utcOffset),
      endedAt: buildIsoAtBusinessDate(businessDate, "11:38:00", utcOffset),
      points: [
        { lat: -17.73492, lng: 168.31744, accuracy: 7, ts: buildIsoAtBusinessDate(businessDate, "08:58:00", utcOffset) },
        { lat: -17.73624, lng: 168.32016, accuracy: 6, ts: buildIsoAtBusinessDate(businessDate, "09:18:00", utcOffset) },
        { lat: -17.73831, lng: 168.32354, accuracy: 8, ts: buildIsoAtBusinessDate(businessDate, "09:47:00", utcOffset) },
        { lat: -17.73991, lng: 168.32784, accuracy: 8, ts: buildIsoAtBusinessDate(businessDate, "11:06:00", utcOffset) },
        { lat: -17.74183, lng: 168.32948, accuracy: 10, ts: buildIsoAtBusinessDate(businessDate, "11:38:00", utcOffset) }
      ]
    }
  ];

  return {
    dateKey: businessDate,
    checkins,
    visits,
    tracks
  };
}

module.exports = {
  buildDemoAttendanceData,
  getBusinessDateKey
};
