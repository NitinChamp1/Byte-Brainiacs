const Participant = require('../models/Participant');
const Team = require('../models/Team');
const ActivityLog = require('../models/ActivityLog');

// GET /api/dashboard/stats
const getStats = async (req, res) => {
  try {
    const [
      totalParticipants,
      totalTeams,
      totalIndividuals,
      approved,
      rejected,
      pending,
      waitingForTeam,
    ] = await Promise.all([
      Participant.countDocuments(),
      Team.countDocuments(),
      Participant.countDocuments({ registrationType: 'individual' }),
      Participant.countDocuments({ status: 'approved' }),
      Participant.countDocuments({ status: 'rejected' }),
      Participant.countDocuments({ status: 'pending' }),
      Participant.countDocuments({ status: 'waiting_for_team' }),
    ]);

    res.json({
      success: true,
      stats: {
        totalParticipants,
        totalTeams,
        totalIndividuals,
        approved,
        rejected,
        pending,
        waitingForTeam,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/chart-data
const getChartData = async (req, res) => {
  try {
    // Registrations over last 7 days
    const days = 7;
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d);
    }

    const registrationsOverTime = await Promise.all(
      dates.map(async (date) => {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        const count = await Participant.countDocuments({ createdAt: { $gte: start, $lte: end } });
        return {
          date: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          count,
        };
      })
    );

    // Run status and type breakdown queries in parallel
    const [
      approvedCount,
      rejectedCount,
      pendingCount,
      waitingCount,
      individualCount,
      teamCount
    ] = await Promise.all([
      Participant.countDocuments({ status: 'approved' }),
      Participant.countDocuments({ status: 'rejected' }),
      Participant.countDocuments({ status: 'pending' }),
      Participant.countDocuments({ status: 'waiting_for_team' }),
      Participant.countDocuments({ registrationType: 'individual' }),
      Participant.countDocuments({ registrationType: 'team' })
    ]);

    const statusBreakdown = [
      { name: 'Approved', value: approvedCount },
      { name: 'Rejected', value: rejectedCount },
      { name: 'Pending', value: pendingCount },
      { name: 'Waiting for Team', value: waitingCount },
    ];

    const typeBreakdown = [
      { name: 'Individual', value: individualCount },
      { name: 'Team', value: teamCount },
    ];

    res.json({ success: true, registrationsOverTime, statusBreakdown, typeBreakdown });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/activity-logs
const getActivityLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStats, getChartData, getActivityLogs };
