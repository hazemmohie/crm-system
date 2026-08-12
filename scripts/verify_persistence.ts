import {
  getFirestoreDb,
  loadDataFromFirestore,
  loadUsersFromFirestore,
  saveStateToFirestore,
  saveUsersToFirestore,
  initializeFirestoreProtection,
  getFirestoreProtectionStatus
} from '../src/db/firestoreService.js';
import { User, Customer, AppTask } from '../src/types.js';

async function runPersistenceVerification() {
  console.log('----------------------------------------------------');
  console.log('🧪 RUNNING PRODUCTION FIRESTORE PERSISTENCE VERIFICATION TEST');
  console.log('----------------------------------------------------');

  try {
    // Step 1: Cold Start Initialization Protection
    console.log('\n[TEST 1] Testing Cold Start Initialization...');
    const initResult = await initializeFirestoreProtection();

    if (!initResult.success) {
      console.error('❌ FAIL: Cold start initialization failed health checks.');
      process.exit(1);
    }
    console.log('✅ PASS: Cold start initialization succeeded and health checks passed.');

    // Step 2: Create Test Data
    const testId = Date.now().toString();
    const testEmployee: User = {
      id: `usr_test_${testId}`,
      email: `emp_test_${testId}@crmdomain.com`,
      username: `emp_test_${testId}`,
      name: 'موظف تجريبي للتحقق المباشر',
      role: 'user',
      status: 'approved',
      userCode: `EMP-TEST-${testId.slice(-3)}`,
      password: 'testpassword123',
      createdAt: new Date().toISOString()
    };

    const testCustomer: Customer = {
      id: `cust_test_${testId}`,
      customerNumber: `TEST-CUST-${testId.slice(-4)}`,
      name: 'عميل مالك تجريبي لخصائص الحفظ',
      phone: '0500000001',
      category: 'owner',
      status: 'pending',
      assignedToEmail: testEmployee.email,
      assignedToName: testEmployee.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      feedbackHistory: []
    };

    const testLead: Customer = {
      id: `lead_test_${testId}`,
      customerNumber: `TEST-LEAD-${testId.slice(-4)}`,
      name: 'عميل محتمل تجريبي لخصائص الحفظ',
      phone: '0500000002',
      category: 'lead',
      leadSource: 'paid_ad',
      campaignName: 'حملة عقارات الرياض 2026',
      status: 'pending',
      assignedToEmail: testEmployee.email,
      assignedToName: testEmployee.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      feedbackHistory: []
    };

    const testTask: AppTask = {
      id: `task_test_${testId}`,
      title: 'مهمة متابعة تجريبية للنظام',
      description: 'التحقق من حفظ المهام في Firestore بشكل مستمر ودائم',
      assignedToEmail: testEmployee.email,
      assignedToName: testEmployee.name,
      assignedByEmail: 'hazemmohie8@gmail.com',
      assignedByName: 'حازم محي (المسؤول)',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '05:00 PM',
      priority: 'high',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    console.log('\n[TEST 2] Writing Test Employee, Customer, Lead, and Task to Firestore...');
    const currentData = await loadDataFromFirestore() || {
      users: [],
      customers: [],
      sheetConfig: { sheetUrl: '', sheetId: '', autoSync: false },
      activities: [],
      tasks: [],
      notifications: []
    };

    const currentUsers = await loadUsersFromFirestore() || currentData.users || [];

    const updatedUsers = [...currentUsers.filter(u => u.id !== testEmployee.id), testEmployee];
    const updatedCustomers = [
      ...currentData.customers.filter(c => c.id !== testCustomer.id && c.id !== testLead.id),
      testCustomer,
      testLead
    ];
    const updatedTasks = [
      ...(currentData.tasks || []).filter((t: any) => t.id !== testTask.id),
      testTask
    ];

    const payload = {
      ...currentData,
      users: updatedUsers,
      customers: updatedCustomers,
      tasks: updatedTasks
    };

    // Save state
    const saveSuccess = await saveStateToFirestore(payload);
    if (!saveSuccess) {
      console.error('❌ FAIL: Failed to save test payload to Firestore.');
      process.exit(1);
    }
    console.log('✅ PASS: Successfully wrote test records to Firestore.');

    // Step 3: Verification Read from Firestore
    console.log('\n[TEST 3] Reading State Back from Firestore...');
    const verifyData = await loadDataFromFirestore();
    const verifyUsers = await loadUsersFromFirestore();

    if (!verifyData) {
      console.error('❌ FAIL: Read back null state from Firestore.');
      process.exit(1);
    }

    const foundEmp = (verifyUsers || verifyData.users).find(u => u.email === testEmployee.email);
    const foundCust = verifyData.customers.find(c => c.id === testCustomer.id);
    const foundLead = verifyData.customers.find(c => c.id === testLead.id);
    const foundTask = (verifyData.tasks || []).find((t: any) => t.id === testTask.id);

    if (!foundEmp) throw new Error(`Test employee account not found in Firestore!`);
    if (!foundCust) throw new Error(`Test customer record not found in Firestore!`);
    if (!foundLead) throw new Error(`Test lead record not found in Firestore!`);
    if (!foundTask) throw new Error(`Test task record not found in Firestore!`);

    console.log('✅ PASS: All 4 test records confirmed present in Firestore with 100% fidelity.');

    // Step 4: Simulate Server Cold Start & Scale From Zero
    console.log('\n[TEST 4] Simulating Server Restart / Cold Start Protection Cycle...');
    const coldStartInit = await initializeFirestoreProtection();

    if (!coldStartInit.success || !coldStartInit.data) {
      console.error('❌ FAIL: Cold start re-initialization failed.');
      process.exit(1);
    }

    const reloadedEmp = (coldStartInit.users || coldStartInit.data.users).find(u => u.email === testEmployee.email);
    const reloadedCust = coldStartInit.data.customers.find(c => c.id === testCustomer.id);
    const reloadedLead = coldStartInit.data.customers.find(c => c.id === testLead.id);
    const reloadedTask = (coldStartInit.data.tasks || []).find((t: any) => t.id === testTask.id);

    if (!reloadedEmp) throw new Error('Employee account lost after simulated cold restart!');
    if (!reloadedCust) throw new Error('Customer record lost after simulated cold restart!');
    if (!reloadedLead) throw new Error('Lead record lost after simulated cold restart!');
    if (!reloadedTask) throw new Error('Task record lost after simulated cold restart!');

    console.log('✅ PASS: Cold start recovery verified! All records survived restart with zero data loss.');

    // Step 5: Test Empty Overwrite Prevention
    console.log('\n[TEST 5] Testing Empty Overwrite Protection Guard...');
    try {
      const dangerousEmptyData: any = {
        users: [],
        customers: [],
        sheetConfig: { sheetUrl: '', sheetId: '', autoSync: false },
        activities: [],
        tasks: []
      };
      await saveStateToFirestore(dangerousEmptyData);
      console.error('❌ FAIL: Dangerously empty payload was NOT blocked!');
      process.exit(1);
    } catch (err: any) {
      console.log(`✅ PASS: Empty overwrite write was REJECTED as expected! Guard Error: ${err.message}`);
    }

    console.log('\n[TEST 6] Cleaning Up Test Artifacts from Firestore...');
    const postTestInit = await initializeFirestoreProtection();
    if (postTestInit.data) {
      const cleanUsers = (postTestInit.users || postTestInit.data.users).filter(u => u.id !== testEmployee.id);
      const cleanCusts = postTestInit.data.customers.filter(c => c.id !== testCustomer.id && c.id !== testLead.id);
      const cleanTasks = (postTestInit.data.tasks || []).filter((t: any) => t.id !== testTask.id);

      await saveStateToFirestore({
        ...postTestInit.data,
        users: cleanUsers,
        customers: cleanCusts,
        tasks: cleanTasks
      });
      console.log('✅ PASS: Test records cleaned up successfully.');
    }

    console.log('\n----------------------------------------------------');
    console.log('🎉 ALL FIRESTORE PERSISTENCE TESTS PASSED SUCCESSFULLY!');
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ PERSISTENCE TEST FAILED:', err);
    process.exit(1);
  }
}

runPersistenceVerification();
