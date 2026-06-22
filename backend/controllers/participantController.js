const Participant = require('../models/Participant');
const Team = require('../models/Team');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { sendApprovalEmail, sendRejectionEmail } = require('../utils/email');
const { exportParticipantsToExcel } = require('../utils/export');
const { deleteFromCloudinary } = require('../utils/cloudinary');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Reusable input validators ───────────────────────────────────────────
const EMAIL_REGEX  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/; // Indian mobile: starts with 6-9, exactly 10 digits

/**
 * Validates registration data for the leader (and optionally team members).
 * Returns { valid: true } or { valid: false, message: '...' }
 */
const validateRegistrationInput = (data, members = []) => {
  // GAP 4: validate registrationType up front with a clean message
  if (!['individual', 'team'].includes(data.registrationType)) {
    return { valid: false, message: 'Invalid registration type. Must be "individual" or "team".' };
  }

  // GAP 3 + GAP 2: validate leader email and mobile
  if (!EMAIL_REGEX.test(data.email)) {
    return { valid: false, message: 'Please provide a valid email address.' };
  }
  if (data.mobile && !MOBILE_REGEX.test(data.mobile)) {
    return { valid: false, message: 'Please provide a valid 10-digit Indian mobile number.' };
  }

  // GAP 3 + GAP 2: validate each team member's email and mobile
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const label = `Member ${i + 2}`; // Member 2, Member 3...
    if (!EMAIL_REGEX.test(m.email)) {
      return { valid: false, message: `${label}: Please provide a valid email address.` };
    }
    if (m.mobile && !MOBILE_REGEX.test(m.mobile)) {
      return { valid: false, message: `${label}: Please provide a valid 10-digit Indian mobile number.` };
    }
  }

  return { valid: true };
};

// POST /api/participants/register
const registerParticipant = async (req, res) => {
  // Track created IDs so we can roll back on Razorpay failure (BUG 2 fix)
  let createdParticipantIds = [];
  let createdTeamId = null;

  try {
    const data = req.body;

    // ── GAPS 2, 3, 4 FIX: Validate inputs before touching the DB ─────────
    // Parse team members early so we can validate their fields too
    const rawMembers = data.registrationType === 'team' && data.teamMembers
      ? (typeof data.teamMembers === 'string' ? JSON.parse(data.teamMembers) : data.teamMembers)
      : [];
    const validation = validateRegistrationInput(data, rawMembers);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    // ── BUG 1 FIX: Check leader email for duplicates ──────────────────
    const leaderEmail = data.email?.toLowerCase();
    const existing = await Participant.findOne({ email: leaderEmail });
    if (existing)
      return res.status(409).json({ success: false, message: 'This email is already registered.' });


    const participantData = {
      fullName: data.fullName,
      email: leaderEmail,
      mobile: data.mobile,
      college: data.college,
      degree: data.degree,
      yearOfStudy: data.yearOfStudy,
      city: data.city,
      state: data.state,
      linkedin: data.linkedin,
      github: data.github,
      registrationType: data.registrationType,
    };

    if (req.files) {
      if (req.files['collegeId']) {
        // Cloudinary returns the secure URL directly in the file object
        participantData.collegeIdUrl = req.files['collegeId'][0].path;
      }
    }

    // Dynamic fee calculation: ₹25 per participant
    let memberCount = 1; // leader/individual

    if (data.registrationType === 'team') {
      participantData.teamName = data.teamName;
      participantData.teamMembers = typeof data.teamMembers === 'string'
        ? JSON.parse(data.teamMembers)
        : data.teamMembers;

      // ── BUG 7 FIX: Validate team size (must be 2 or 3 total) ─────────
      const membersProvided = participantData.teamMembers?.length || 0;
      if (membersProvided < 1 || membersProvided > 2) {
        return res.status(400).json({
          success: false,
          message: 'A team must have 2 or 3 members total (leader + 1 or 2 additional members).',
        });
      }

      // ── BUG 1 FIX: Check ALL team member emails for duplicates ────────
      const memberEmails = participantData.teamMembers.map(m => m.email?.toLowerCase());
      const allEmailsToCheck = [leaderEmail, ...memberEmails];

      // Check for duplicates within the form itself
      const uniqueEmails = new Set(allEmailsToCheck);
      if (uniqueEmails.size !== allEmailsToCheck.length) {
        return res.status(409).json({
          success: false,
          message: 'Duplicate email addresses found within the team. Each member must have a unique email.',
        });
      }

      // Check member emails against the database
      const existingMembers = await Participant.find({ email: { $in: memberEmails } }).select('email');
      if (existingMembers.length > 0) {
        const dupes = existingMembers.map(p => p.email).join(', ');
        return res.status(409).json({
          success: false,
          message: `These emails are already registered: ${dupes}`,
        });
      }

      memberCount = 1 + membersProvided; // leader + members
      participantData.status = 'pending';
    } else {
      participantData.status = 'waiting_for_team';
    }

    participantData.amount = memberCount * 25;
    participantData.paymentStatus = 'pending';

    const participant = await Participant.create(participantData);
    createdParticipantIds.push(participant._id);

    // Automatically create Team and Participant records for members
    if (participantData.registrationType === 'team' && participantData.teamMembers) {
      const memberIds = [participant._id];

      for (const memberData of participantData.teamMembers) {
        const member = await Participant.create({
          fullName: memberData.fullName,
          email: memberData.email?.toLowerCase(),
          mobile: memberData.mobile,
          college: memberData.college,
          degree: memberData.degree,
          yearOfStudy: memberData.yearOfStudy,
          registrationType: 'team',
          status: 'pending',
          paymentStatus: 'pending',
          teamName: participantData.teamName,
        });
        memberIds.push(member._id);
        createdParticipantIds.push(member._id);
      }

      const team = await Team.create({
        teamName: participantData.teamName,
        members: memberIds,
        status: 'pending',
        isAllocated: false,
        createdBy: 'self',
      });
      createdTeamId = team._id;

      // Update all newly created participants (leader + members) with the team ID
      await Participant.updateMany(
        { _id: { $in: memberIds } },
        { teamId: team._id }
      );

      participant.teamId = team._id;
    }

    // ── BUG 2 FIX: Razorpay order creation with rollback on failure ───
    let order;
    try {
      const options = {
        amount: participantData.amount * 100, // Amount in paise
        currency: 'INR',
        receipt: `receipt_${participant._id}`,
      };
      order = await razorpay.orders.create(options);
    } catch (razorpayErr) {
      // Razorpay failed — roll back all DB records created in this request
      console.error('❌ Razorpay order creation failed, rolling back:', razorpayErr.message);
      if (createdTeamId) await Team.findByIdAndDelete(createdTeamId);
      if (createdParticipantIds.length > 0)
        await Participant.deleteMany({ _id: { $in: createdParticipantIds } });
      return res.status(502).json({
        success: false,
        message: 'Payment gateway error. Please try again. No data was saved.',
      });
    }

    // Store the Razorpay order ID
    participant.razorpayOrderId = order.id;
    await participant.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful! Proceeding to payment...',
      participant,
      orderId: order.id,
      amount: participantData.amount * 100,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Registration error:', err);
    // Roll back any partial DB writes on unexpected errors
    if (createdTeamId) await Team.findByIdAndDelete(createdTeamId).catch(() => {});
    if (createdParticipantIds.length > 0)
      await Participant.deleteMany({ _id: { $in: createdParticipantIds } }).catch(() => {});
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/participants
const getParticipants = async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type) filter.registrationType = type;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { college: { $regex: search, $options: 'i' } },
        { teamName: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Participant.countDocuments(filter);
    const participants = await Participant.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('teamId', 'teamName status');

    res.json({ success: true, total, page: parseInt(page), participants });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/participants/:id
const getParticipantById = async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id).populate('teamId');
    if (!participant)
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    res.json({ success: true, participant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/participants/:id/status
const updateParticipantStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const validStatuses = ['pending', 'approved', 'rejected', 'waiting_for_team'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });

    const participant = await Participant.findByIdAndUpdate(
      req.params.id,
      { status, adminNote },
      { new: true }
    );
    if (!participant)
      return res.status(404).json({ success: false, message: 'Participant not found.' });

    // Send email & notification
    try {
      if (status === 'approved') {
        await sendApprovalEmail(participant);
        await Notification.create({
          email: participant.email,
          message: `Congratulations! Your registration for ByteBrainiacs has been approved.`,
          type: 'approval',
        });
      } else if (status === 'rejected') {
        await sendRejectionEmail(participant, adminNote);
        await Notification.create({
          email: participant.email,
          message: `Your registration was not selected. ${adminNote || ''}`,
          type: 'rejection',
        });
      }
    } catch (emailErr) {
      console.error('⚠️ Participant status updated, but failed to send email/notification:', emailErr.message);
    }

    // Log activity
    await ActivityLog.create({
      adminId: req.user._id,
      adminName: req.user.name,
      action: `${status.charAt(0).toUpperCase() + status.slice(1)} Participant`,
      targetType: 'participant',
      targetId: participant._id,
      targetName: participant.fullName,
    });

    res.json({ success: true, message: `Participant ${status}.`, participant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/participants/export
const exportParticipants = async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type) filter.registrationType = type;
    if (status) filter.status = status;

    const participants = await Participant.find(filter).sort({ createdAt: -1 });
    const workbook = await exportParticipantsToExcel(participants);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ByteBrainiacs_Participants.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/participants/:id
const deleteParticipant = async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }

    // ── BUG 8 FIX: Clear teamId on remaining members when deleting ────
    if (participant.teamId) {
      const team = await Team.findById(participant.teamId);
      if (team) {
        const remainingMemberIds = team.members.filter(
          memberId => memberId.toString() !== participant._id.toString()
        );

        if (remainingMemberIds.length < 2) {
          // Team is now below minimum size (min 2). Disband team and return straggler(s) to pool.
          await Participant.updateMany(
            { _id: { $in: remainingMemberIds } },
            { $unset: { teamId: '' } }
          );
          await Team.findByIdAndDelete(team._id);
        } else {
          // Still has >= 2 members (valid size). Just update team list.
          team.members = remainingMemberIds;
          await team.save();
        }
      }
    }

    // Delete college ID file from Cloudinary if it exists
    if (participant.collegeIdUrl) {
      await deleteFromCloudinary(participant.collegeIdUrl);
    }

    await Participant.findByIdAndDelete(req.params.id);

    // Log activity
    await ActivityLog.create({
      adminId: req.user._id,
      adminName: req.user.name,
      action: 'Delete Participant',
      targetType: 'participant',
      targetId: participant._id,
      targetName: participant.fullName,
    });

    res.json({ success: true, message: 'Participant deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  registerParticipant,
  getParticipants,
  getParticipantById,
  updateParticipantStatus,
  exportParticipants,
  deleteParticipant,
};
