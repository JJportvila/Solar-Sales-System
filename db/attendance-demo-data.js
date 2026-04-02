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

function offsetDateKey(dateKey = "", offsetDays = 0) {
  const [year, month, day] = String(dateKey || "").split("-").map((value) => Number(value));
  if (!year || !month || !day) return String(dateKey || "").trim();
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
  return utcDate.toISOString().slice(0, 10);
}

function buildDailySeed(userId, dateKey, dayOffset, utcOffset) {
  const salesStartMinute = 48 + (dayOffset % 4) * 2;
  const salesEndMinute = 8 + (dayOffset % 5) * 3;
  const engineerStartMinute = 30 + (dayOffset % 5) * 3;
  const engineerEndMinute = 44 + (dayOffset % 4) * 2;
  const managerStartMinute = 40 + (dayOffset % 3) * 4;
  const salesLat = -17.736 + dayOffset * 0.00018;
  const salesLng = 168.317 + dayOffset * 0.00021;
  const engineerLat = -17.746 + dayOffset * 0.00015;
  const engineerLng = 168.314 + dayOffset * 0.00018;
  const managerLat = -17.739 + dayOffset * 0.00012;
  const managerLng = 168.321 + dayOffset * 0.00014;

  if (userId === "emp-sales-001") {
    return {
      checkins: [
        {
          id: `demo-chk-in-sales-001-${dateKey}`,
          userId,
          action: "in",
          lat: Number(salesLat.toFixed(5)),
          lng: Number(salesLng.toFixed(5)),
          accuracy: 6 + (dayOffset % 4),
          note: "门店晨会后开始客户拜访",
          ts: buildIsoAtBusinessDate(dateKey, `08:${String(salesStartMinute).padStart(2, "0")}:00`, utcOffset),
          date: dateKey
        },
        {
          id: `demo-chk-out-sales-001-${dateKey}`,
          userId,
          action: "out",
          lat: Number((salesLat + 0.0064).toFixed(5)),
          lng: Number((salesLng + 0.0106).toFixed(5)),
          accuracy: 8 + (dayOffset % 3),
          note: "完成客户跟进后返回门店",
          ts: buildIsoAtBusinessDate(dateKey, `17:${String(salesEndMinute).padStart(2, "0")}:00`, utcOffset),
          date: dateKey
        }
      ],
      visits: [
        {
          id: `demo-visit-sales-001-${dateKey}`,
          userId,
          customer: dayOffset % 2 === 0 ? "Port Vila Solar Mart" : "Fresh Mart Corner Shop",
          note: dayOffset % 2 === 0 ? "复盘陈列和补货需求，确认本周促销套餐。" : "核对小店收款与库存，补录当日门店销量。",
          lat: Number((salesLat + 0.0035).toFixed(5)),
          lng: Number((salesLng + 0.0061).toFixed(5)),
          accuracy: 7 + (dayOffset % 3),
          address: dayOffset % 2 === 0 ? "Port Vila town center" : "Fresh Mart roadside stop",
          audioUrl: "",
          photoUrls: [],
          recordedAt: buildIsoAtBusinessDate(dateKey, "11:08:00", utcOffset)
        }
      ],
      tracks: [
        {
          id: `demo-track-sales-001-${dateKey}`,
          userId,
          date: dateKey,
          startedAt: buildIsoAtBusinessDate(dateKey, `08:${String(Math.max(0, salesStartMinute + 4)).padStart(2, "0")}:00`, utcOffset),
          endedAt: buildIsoAtBusinessDate(dateKey, "15:22:00", utcOffset),
          points: [
            { lat: Number(salesLat.toFixed(5)), lng: Number(salesLng.toFixed(5)), accuracy: 6, ts: buildIsoAtBusinessDate(dateKey, "08:58:00", utcOffset) },
            { lat: Number((salesLat + 0.0014).toFixed(5)), lng: Number((salesLng + 0.0023).toFixed(5)), accuracy: 7, ts: buildIsoAtBusinessDate(dateKey, "09:26:00", utcOffset) },
            { lat: Number((salesLat + 0.0030).toFixed(5)), lng: Number((salesLng + 0.0049).toFixed(5)), accuracy: 8, ts: buildIsoAtBusinessDate(dateKey, "10:14:00", utcOffset) },
            { lat: Number((salesLat + 0.0035).toFixed(5)), lng: Number((salesLng + 0.0061).toFixed(5)), accuracy: 7, ts: buildIsoAtBusinessDate(dateKey, "11:08:00", utcOffset) },
            { lat: Number((salesLat + 0.0052).toFixed(5)), lng: Number((salesLng + 0.0084).toFixed(5)), accuracy: 8, ts: buildIsoAtBusinessDate(dateKey, "13:34:00", utcOffset) },
            { lat: Number((salesLat + 0.0064).toFixed(5)), lng: Number((salesLng + 0.0106).toFixed(5)), accuracy: 9, ts: buildIsoAtBusinessDate(dateKey, "15:22:00", utcOffset) }
          ]
        }
      ]
    };
  }

  if (userId === "emp-eng-001") {
    return {
      checkins: [
        {
          id: `demo-chk-in-eng-001-${dateKey}`,
          userId,
          action: "in",
          lat: Number(engineerLat.toFixed(5)),
          lng: Number(engineerLng.toFixed(5)),
          accuracy: 9,
          note: "仓库领料后出发维护点位",
          ts: buildIsoAtBusinessDate(dateKey, `08:${String(engineerStartMinute).padStart(2, "0")}:00`, utcOffset),
          date: dateKey
        },
        {
          id: `demo-chk-out-eng-001-${dateKey}`,
          userId,
          action: "out",
          lat: Number((engineerLat + 0.021).toFixed(5)),
          lng: Number((engineerLng + 0.012).toFixed(5)),
          accuracy: 11,
          note: "现场维修完成后回到 Port Vila",
          ts: buildIsoAtBusinessDate(dateKey, `17:${String(engineerEndMinute).padStart(2, "0")}:00`, utcOffset),
          date: dateKey
        }
      ],
      visits: [
        {
          id: `demo-visit-eng-001-${dateKey}`,
          userId,
          customer: dayOffset % 2 === 0 ? "Emae Village Center" : "Teouma Battery Station",
          note: dayOffset % 2 === 0 ? "检查逆变器告警并完成电池均衡。" : "更换接线端子并复测输出电压。",
          lat: Number((engineerLat + 0.0092).toFixed(5)),
          lng: Number((engineerLng + 0.0061).toFixed(5)),
          accuracy: 11,
          address: dayOffset % 2 === 0 ? "Port Vila feeder depot, Efate" : "Teouma roadside site",
          audioUrl: "",
          photoUrls: [],
          recordedAt: buildIsoAtBusinessDate(dateKey, "10:16:00", utcOffset)
        }
      ],
      tracks: [
        {
          id: `demo-track-eng-001-${dateKey}`,
          userId,
          date: dateKey,
          startedAt: buildIsoAtBusinessDate(dateKey, "08:36:00", utcOffset),
          endedAt: buildIsoAtBusinessDate(dateKey, "12:02:00", utcOffset),
          points: [
            { lat: Number(engineerLat.toFixed(5)), lng: Number(engineerLng.toFixed(5)), accuracy: 9, ts: buildIsoAtBusinessDate(dateKey, "08:36:00", utcOffset) },
            { lat: Number((engineerLat + 0.0015).toFixed(5)), lng: Number((engineerLng + 0.0018).toFixed(5)), accuracy: 10, ts: buildIsoAtBusinessDate(dateKey, "08:56:00", utcOffset) },
            { lat: Number((engineerLat + 0.0040).toFixed(5)), lng: Number((engineerLng + 0.0036).toFixed(5)), accuracy: 8, ts: buildIsoAtBusinessDate(dateKey, "09:30:00", utcOffset) },
            { lat: Number((engineerLat + 0.0092).toFixed(5)), lng: Number((engineerLng + 0.0061).toFixed(5)), accuracy: 11, ts: buildIsoAtBusinessDate(dateKey, "10:16:00", utcOffset) },
            { lat: Number((engineerLat + 0.0154).toFixed(5)), lng: Number((engineerLng + 0.0094).toFixed(5)), accuracy: 12, ts: buildIsoAtBusinessDate(dateKey, "11:08:00", utcOffset) },
            { lat: Number((engineerLat + 0.021).toFixed(5)), lng: Number((engineerLng + 0.012).toFixed(5)), accuracy: 12, ts: buildIsoAtBusinessDate(dateKey, "12:02:00", utcOffset) }
          ]
        }
      ]
    };
  }

  return {
    checkins: [
      {
        id: `demo-chk-in-mgr-001-${dateKey}`,
        userId,
        action: "in",
        lat: Number(managerLat.toFixed(5)),
        lng: Number(managerLng.toFixed(5)),
        accuracy: 7,
        note: "总部晨会后开始门店巡检",
        ts: buildIsoAtBusinessDate(dateKey, `08:${String(managerStartMinute).padStart(2, "0")}:00`, utcOffset),
        date: dateKey
      }
    ],
    visits: [
      {
        id: `demo-visit-mgr-001-${dateKey}`,
        userId,
        customer: "Port Vila Headquarters",
        note: "复盘签到纪律与外勤覆盖率，抽检销售 GPS 采点。",
        lat: Number((managerLat + 0.0024).toFixed(5)),
        lng: Number((managerLng + 0.0019).toFixed(5)),
        accuracy: 6,
        address: "Port Vila HQ",
        audioUrl: "",
        photoUrls: [],
        recordedAt: buildIsoAtBusinessDate(dateKey, "14:18:00", utcOffset)
      }
    ],
    tracks: [
      {
        id: `demo-track-mgr-001-${dateKey}`,
        userId,
        date: dateKey,
        startedAt: buildIsoAtBusinessDate(dateKey, "09:06:00", utcOffset),
        endedAt: buildIsoAtBusinessDate(dateKey, "14:42:00", utcOffset),
        points: [
          { lat: Number(managerLat.toFixed(5)), lng: Number(managerLng.toFixed(5)), accuracy: 7, ts: buildIsoAtBusinessDate(dateKey, "09:06:00", utcOffset) },
          { lat: Number((managerLat + 0.0011).toFixed(5)), lng: Number((managerLng + 0.0010).toFixed(5)), accuracy: 6, ts: buildIsoAtBusinessDate(dateKey, "10:20:00", utcOffset) },
          { lat: Number((managerLat + 0.0024).toFixed(5)), lng: Number((managerLng + 0.0019).toFixed(5)), accuracy: 6, ts: buildIsoAtBusinessDate(dateKey, "14:18:00", utcOffset) },
          { lat: Number((managerLat + 0.0033).toFixed(5)), lng: Number((managerLng + 0.0028).toFixed(5)), accuracy: 7, ts: buildIsoAtBusinessDate(dateKey, "14:42:00", utcOffset) }
        ]
      }
    ]
  };
}

function buildDemoAttendanceData({ timeZone = "Pacific/Efate", dateKey, utcOffset = "+11:00", days = 15 } = {}) {
  const endDate = String(dateKey || getBusinessDateKey(timeZone)).trim();
  const totalDays = Math.max(1, Math.round(Number(days) || 15));
  const startDate = offsetDateKey(endDate, -(totalDays - 1));
  const dates = Array.from({ length: totalDays }, (_, index) => offsetDateKey(startDate, index));
  const users = ["emp-eng-001", "emp-sales-001", "emp-sales-mgr-001"];

  const payload = dates.reduce((acc, currentDate, index) => {
    users.forEach((userId) => {
      const seed = buildDailySeed(userId, currentDate, index, utcOffset);
      acc.checkins.push(...seed.checkins);
      acc.visits.push(...seed.visits);
      acc.tracks.push(...seed.tracks);
    });
    return acc;
  }, { checkins: [], visits: [], tracks: [] });

  return {
    dateKey: endDate,
    startDate,
    endDate,
    checkins: payload.checkins,
    visits: payload.visits,
    tracks: payload.tracks
  };
}

module.exports = {
  buildDemoAttendanceData,
  getBusinessDateKey
};
