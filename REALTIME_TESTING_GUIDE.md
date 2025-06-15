# 🧪 MindFlow Real-time Collaboration Testing Guide

## Overview
This guide helps you test the real-time collaboration features in MindFlow. The system includes user presence, live cursors, conflict resolution, and collaborative tools.

## Prerequisites
- MindFlow running in development mode (`npm run dev`)
- User authentication enabled
- Multiple browser windows/tabs for multi-user simulation

## 🎯 Test Scenarios

### 1. Basic Real-time Connection
**Goal**: Verify basic real-time connectivity

**Steps**:
1. Open MindFlow in Browser A
2. Sign in with user account
3. Verify connection status indicator (bottom-left) shows "Connected"
4. Open MindFlow in Browser B (different browser or incognito)
5. Sign in with different user account
6. Check that both browsers show "2人が接続中" in user presence panel

**Expected Results**:
- ✅ Connection status shows "Connected" with green indicator
- ✅ User presence panel appears (top-right)
- ✅ Both users visible in presence panel with different colors
- ✅ Real-time status indicator updates correctly

### 2. Live Cursor Sharing
**Goal**: Test real-time cursor movement and node selection

**Steps**:
1. With both browsers connected (from Test 1)
2. In Browser A: Click on different nodes
3. In Browser B: Observe cursor indicators
4. In Browser B: Click on different nodes
5. In Browser A: Observe cursor indicators

**Expected Results**:
- ✅ Cursor positions update in real-time
- ✅ User avatars appear near selected nodes
- ✅ Cursor indicators show correct user colors and names
- ✅ Inactive cursors disappear after 5 seconds

### 3. Simultaneous Node Editing
**Goal**: Test concurrent editing and conflict resolution

**Steps**:
1. With both browsers connected
2. Both users select the same node
3. Both users start editing simultaneously:
   - Browser A: Change text to "Updated by User A"
   - Browser B: Change text to "Updated by User B"
4. Submit changes quickly (within 1 second)
5. Check for conflict notifications

**Expected Results**:
- ✅ Conflict notification appears (top-center)
- ✅ Final text reflects conflict resolution (last writer wins)
- ✅ Both browsers show consistent final state
- ✅ Conflict notification auto-dismisses after 8 seconds

### 4. Node Creation and Positioning
**Goal**: Test concurrent node creation

**Steps**:
1. Both users select the same parent node
2. Both users create child nodes simultaneously:
   - Browser A: Add child "Child A"
   - Browser B: Add child "Child B"
3. Observe positioning and conflict resolution

**Expected Results**:
- ✅ Both child nodes are created
- ✅ Positions are automatically adjusted if too close
- ✅ No duplicate nodes or data corruption
- ✅ Auto-layout applies consistently

### 5. Collaborative Features Panel
**Goal**: Test comments, history, and user management

**Steps**:
1. Click connection status indicator (bottom-left)
2. Click "共同編集機能" button
3. Navigate through different tabs:
   - Comments: Add a comment to selected node
   - History: View activity timeline
   - Users: See connected users list

**Expected Results**:
- ✅ Collaborative features panel opens
- ✅ All tabs are functional
- ✅ Comments can be added and marked as resolved
- ✅ Activity history shows real-time updates
- ✅ Users list shows current participants

### 6. Performance Monitoring (Development)
**Goal**: Verify performance optimization works

**Steps**:
1. Press Ctrl+Shift+P to open performance dashboard
2. Perform various actions (node editing, moving, creating)
3. Monitor performance metrics
4. Check for warnings about slow renders

**Expected Results**:
- ✅ Performance dashboard opens (bottom-left)
- ✅ Render times stay below 16ms for 60fps
- ✅ Memory usage remains stable
- ✅ WebSocket message rate is reasonable
- ✅ No performance warnings in console

### 7. Connection Resilience
**Goal**: Test auto-reconnection and offline handling

**Steps**:
1. With real-time connected, disconnect internet
2. Try to make changes (should be queued)
3. Reconnect internet
4. Verify changes are synchronized

**Expected Results**:
- ✅ Connection status changes to "Reconnecting"
- ✅ Changes are queued during disconnection
- ✅ Auto-reconnection occurs when connection restored
- ✅ Queued changes are sent after reconnection
- ✅ All browsers reach consistent state

## 🐛 Common Issues & Solutions

### Connection Issues
- **Problem**: "切断" status persists
- **Solution**: Check authentication, refresh page, verify server status

### Performance Issues
- **Problem**: Slow rendering or lag
- **Solution**: Check performance dashboard, reduce connected users, clear browser cache

### Conflict Resolution Issues
- **Problem**: Inconsistent state between browsers
- **Solution**: Force refresh, check network connectivity, verify timestamps

### UI Issues
- **Problem**: Components not appearing
- **Solution**: Verify authentication, check browser developer tools, ensure real-time features are enabled

## 📊 Success Criteria

### Functional Requirements
- [ ] Real-time connection established reliably
- [ ] User presence works across multiple browsers
- [ ] Live cursors update smoothly
- [ ] Conflict resolution prevents data corruption
- [ ] Collaborative features (comments, history) work
- [ ] Auto-reconnection handles network issues

### Performance Requirements
- [ ] Render times < 16ms for smooth 60fps
- [ ] Memory usage stable during extended use
- [ ] WebSocket messages batched efficiently
- [ ] No memory leaks during long sessions

### Usability Requirements
- [ ] Intuitive UI for collaboration features
- [ ] Clear visual feedback for conflicts
- [ ] Responsive design works on mobile
- [ ] Accessibility features function properly

## 🔧 Development Tools

### Browser Developer Tools
- **Console**: Check for errors and performance warnings
- **Network**: Monitor WebSocket connections
- **Performance**: Profile rendering and memory usage
- **Application**: Inspect localStorage and authentication state

### MindFlow Built-in Tools
- **Performance Dashboard**: Ctrl+Shift+P (development mode)
- **Connection Status**: Bottom-left indicator
- **User Presence**: Top-right panel
- **Collaborative Features**: Via connection status panel

## 📝 Reporting Issues

When reporting issues, please include:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Console error messages
5. Network connectivity status
6. Number of concurrent users

## 🎉 Testing Complete!

Once all test scenarios pass, the real-time collaboration system is ready for production use. The system should handle multiple concurrent users seamlessly with automatic conflict resolution and optimal performance.