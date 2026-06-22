const Team = require('../models/Team');
const Participant = require('../models/Participant');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { sendTeamAllocationEmail, sendTeamApprovalEmail } = require('../utils/email');

// GET /api/teams
const getTeams = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.teamName = { $regex: search, $options: 'i' };

    const total = await Team.countDocuments(filter);
    const teams = await Team.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('members', 'fullName email college status');

    res.json({ success: true, total, page: parseInt(page), teams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/teams/:id/status
const updateTeamStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });

    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { status, adminNote },
      { new: true }
    ).populate('members', 'fullName email college');

    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

    // Update member statuses
    const memberStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
    await Participant.updateMany({ teamId: team._id }, { status: memberStatus });

    // If team is approved, send email to all members
    try {
      if (status === 'approved' && team.members && team.members.length > 0) {
        const memberEmails = team.members.map(m => m.email);
        const leaderParticipant = await Participant.findOne({ teamName: team.teamName }); // Fallback for leader name
        const leaderName = leaderParticipant ? leaderParticipant.fullName : team.members[0].fullName;
        
        await sendTeamApprovalEmail(team.teamName, memberEmails.join(', '), leaderName);
      }
    } catch (emailErr) {
      console.error('⚠️ Team status updated, but failed to send email:', emailErr.message);
    }

    await ActivityLog.create({
      adminId: req.user._id,
      adminName: req.user.name,
      action: `${status.charAt(0).toUpperCase() + status.slice(1)} Team`,
      targetType: 'team',
      targetId: team._id,
      targetName: team.teamName,
    });

    res.json({ success: true, message: `Team ${status}.`, team });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/teams/approved-individuals
const getApprovedIndividuals = async (req, res) => {
  try {
    // BUG 4 FIX: Use $or to catch both cases:
    // - participants who never had a teamId ($exists: false)
    // - participants whose teamId was cleared after deletion ($eq: null)
    const individuals = await Participant.find({
      registrationType: 'individual',
      status: 'approved',
      $or: [{ teamId: { $exists: false } }, { teamId: null }],
    }).select('fullName email college degree yearOfStudy city');
    res.json({ success: true, individuals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/teams/allocate
const allocateTeam = async (req, res) => {
  try {
    const { memberIds, teamName } = req.body;

    if (!memberIds || memberIds.length < 2 || memberIds.length > 3)
      return res.status(400).json({ success: false, message: 'Teams must have 2 or 3 members.' });

    if (!teamName || teamName.trim() === '')
      return res.status(400).json({ success: false, message: 'Team name is required.' });

    // Check all are approved individuals without a team
    const members = await Participant.find({
      _id: { $in: memberIds },
      registrationType: 'individual',
      status: 'approved',
    });

    if (members.length !== memberIds.length)
      return res.status(400).json({ success: false, message: 'Some selected participants are not eligible.' });

    // Check none already in a team
    const alreadyInTeam = members.filter((m) => m.teamId);
    if (alreadyInTeam.length > 0)
      return res.status(400).json({
        success: false,
        message: `${alreadyInTeam.map((m) => m.fullName).join(', ')} already belong to a team.`,
      });

    // Create team
    const team = await Team.create({
      teamName: teamName.trim(),
      members: memberIds,
      status: 'approved',
      isAllocated: true,
      createdBy: 'admin',
    });

    // Update participants
    await Participant.updateMany({ _id: { $in: memberIds } }, { teamId: team._id, status: 'approved' });

    // Send notifications & emails
    try {
      for (const member of members) {
        const teammates = members.filter((m) => m._id.toString() !== member._id.toString());
        await sendTeamAllocationEmail(member, teamName, teammates);
        await Notification.create({
          email: member.email,
          message: `You've been allocated to Team "${teamName}" with ${teammates.map((t) => t.fullName).join(' & ')}.`,
          type: 'team_allocation',
        });
      }
    } catch (emailErr) {
      console.error('⚠️ Team allocated, but failed to send some emails/notifications:', emailErr.message);
    }

    await ActivityLog.create({
      adminId: req.user._id,
      adminName: req.user.name,
      action: 'Allocated Team',
      targetType: 'team',
      targetId: team._id,
      targetName: teamName,
      details: `Members: ${members.map((m) => m.fullName).join(', ')}`,
    });

    res.status(201).json({ success: true, message: 'Team allocated successfully!', team });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getTeams, updateTeamStatus, getApprovedIndividuals, allocateTeam };
