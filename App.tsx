import { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Calendar, 
  Camera, 
  BookOpen, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  GraduationCap,
  Save,
  FileDown,
  UserCircle,
  Wallet,
  Settings,
  ArrowLeftRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Class, Student, Record } from './types';

// Extend jsPDF with autotable types
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

type ViewMode = 'attendance' | 'tuition';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('attendance');
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentTuition, setNewStudentTuition] = useState('0');
  const [newStudentSessions, setNewStudentSessions] = useState('8');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch classes on mount
  useEffect(() => {
    fetch('/api/classes')
      .then(res => res.json())
      .then(data => {
        setClasses(data);
        if (data.length > 0 && !selectedClass) {
          setSelectedClass(data[0]);
        }
      });
  }, []);

  // Fetch students and records when class or date changes
  useEffect(() => {
    if (selectedClass) {
      fetch(`/api/classes/${selectedClass.id}/students`)
        .then(res => res.json())
        .then(setStudents);

      fetch(`/api/records?date=${currentDate}&class_id=${selectedClass.id}`)
        .then(res => res.json())
        .then(setRecords);
    }
  }, [selectedClass, currentDate]);

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClassName })
    });
    const newClass = await res.json();
    setClasses([...classes, newClass]);
    setNewClassName('');
    setIsAddingClass(false);
    setSelectedClass(newClass);
  };

  const handleAddStudent = async () => {
    if (!newStudentName.trim() || !selectedClass) return;
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        class_id: selectedClass.id, 
        name: newStudentName,
        tuition_rate: parseInt(newStudentTuition) || 0,
        planned_sessions: parseInt(newStudentSessions) || 8
      })
    });
    const newStudent = await res.json();
    setStudents([...students, newStudent]);
    setNewStudentName('');
    setNewStudentTuition('0');
    setNewStudentSessions('8');
    setIsAddingStudent(false);
  };

  const updateStudentTuition = async (studentId: number, rate: number) => {
    await fetch(`/api/students/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tuition_rate: rate })
    });
    setStudents(students.map(s => s.id === studentId ? { ...s, tuition_rate: rate } : s));
  };

  const updateStudentSessions = async (studentId: number, sessions: number) => {
    await fetch(`/api/students/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planned_sessions: sessions })
    });
    setStudents(students.map(s => s.id === studentId ? { ...s, planned_sessions: sessions } : s));
  };

  const updateRecord = (studentId: number, field: keyof Record, value: any) => {
    setRecords(prev => {
      const existing = prev.find(r => r.student_id === studentId);
      if (existing) {
        return prev.map(r => r.student_id === studentId ? { ...r, [field]: value } : r);
      } else {
        const newRecord: Record = {
          student_id: studentId,
          date: currentDate,
          status: null,
          camera: 0,
          homework: 0,
          test_score: '',
          test_comment: '',
          comment: '',
          [field]: value
        };
        return [...prev, newRecord];
      }
    });
  };

  const saveRecords = async () => {
    setIsSaving(true);
    try {
      const promises = students.map(student => {
        const record = records.find(r => r.student_id === student.id) || {
          student_id: student.id,
          date: currentDate,
          status: null,
          camera: 0,
          homework: 0,
          test_score: '',
          test_comment: '',
          comment: ''
        };
        return fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        });
      });
      await Promise.all(promises);
      alert('Đã lưu thành công!');
    } catch (error) {
      console.error(error);
      alert('Lỗi khi lưu dữ liệu');
    } finally {
      setIsSaving(false);
    }
  };

  const exportStudentPDF = (student: Student) => {
    const record = records.find(r => r.student_id === student.id);
    if (!record) {
      alert('Chưa có dữ liệu cho học sinh này trong ngày hôm nay.');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('PHIẾU NHẬN XÉT HỌC TẬP', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Ngày: ${currentDate}`, 20, 35);
    doc.text(`Học sinh: ${student.name}`, 20, 45);
    doc.text(`Lớp: ${selectedClass?.name}`, 20, 55);

    const tableData = [
      ['Trạng thái', record.status === 'present' ? 'Có mặt' : record.status === 'absent' ? 'Vắng mặt' : 'Chưa điểm danh'],
      ['Mở Camera', record.camera === 1 ? 'Có' : 'Không'],
      ['Làm BTVN', record.homework === 1 ? 'Đầy đủ' : 'Chưa làm'],
      ['Điểm định kỳ', record.test_score || 'N/A'],
      ['Nhận xét điểm', record.test_comment || 'Không có'],
      ['Nhận xét buổi học', record.comment || 'Không có']
    ];

    doc.autoTable({
      startY: 65,
      head: [['Hạng mục', 'Thông tin']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`Nhan_Xet_${student.name.replace(/\s+/g, '_')}_${currentDate}.pdf`);
  };

  const exportMonthlyAttendancePDF = async () => {
    if (!selectedClass) return;
    const yearMonth = currentDate.substring(0, 7); // YYYY-MM
    const res = await fetch(`/api/records/monthly?month=${yearMonth}&class_id=${selectedClass.id}`);
    const monthlyRecords: Record[] = await res.json();

    const doc = new jsPDF('l');
    doc.setFontSize(18);
    doc.text(`BẢNG ĐIỂM DANH THÁNG ${yearMonth} - LỚP ${selectedClass.name}`, 148, 20, { align: 'center' });

    const daysInMonth = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0).getDate();
    const headers = ['STT', 'Họ Tên', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())];

    const rows = students.map((s, idx) => {
      const studentRow: any[] = [idx + 1, s.name];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${yearMonth}-${d.toString().padStart(2, '0')}`;
        const record = monthlyRecords.find(r => r.student_id === s.id && r.date === dateStr);
        if (!record) studentRow.push('');
        else if (record.status === 'present') studentRow.push('V');
        else if (record.status === 'absent') studentRow.push('X');
        else studentRow.push('');
      }
      return studentRow;
    });

    doc.autoTable({
      startY: 30,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 40 } }
    });

    doc.save(`Diem_Danh_Thang_${yearMonth}_${selectedClass.name}.pdf`);
  };

  const exportTuitionPDF = async (student: Student) => {
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().substring(0, 7);

    // Fetch last month's records to count absences
    const res = await fetch(`/api/records/monthly?month=${lastMonth}&class_id=${selectedClass?.id}`);
    const lastMonthRecords: Record[] = await res.json();
    const absences = lastMonthRecords.filter(r => r.student_id === student.id && r.status === 'absent').length;

    const plannedSessions = student.planned_sessions || 8;
    const baseTuition = plannedSessions * student.tuition_rate;
    const deduction = absences * student.tuition_rate;
    const total = baseTuition - deduction;

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('THÔNG BÁO HỌC PHÍ', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Học sinh: ${student.name}`, 20, 40);
    doc.text(`Lớp: ${selectedClass?.name}`, 20, 50);
    doc.text(`Tháng thu phí: ${currentMonth}`, 20, 60);

    const tableData = [
      ['Số buổi dự kiến tháng này', plannedSessions.toString()],
      ['Đơn giá / buổi', student.tuition_rate.toLocaleString() + ' VND'],
      ['Học phí gốc', baseTuition.toLocaleString() + ' VND'],
      ['Số buổi nghỉ tháng trước (' + lastMonth + ')', absences.toString()],
      ['Số tiền được trừ', '-' + deduction.toLocaleString() + ' VND'],
      ['TỔNG CỘNG CẦN ĐÓNG', total.toLocaleString() + ' VND']
    ];

    doc.autoTable({
      startY: 70,
      body: tableData,
      theme: 'grid',
      styles: { fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } }
    });

    doc.text('Vui lòng hoàn thành học phí trước ngày 10 hàng tháng.', 20, doc.lastAutoTable.finalY + 20);
    doc.text('Trân trọng!', 20, doc.lastAutoTable.finalY + 30);

    doc.save(`Hoc_Phi_${student.name.replace(/\s+/g, '_')}_${currentMonth}.pdf`);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 text-indigo-600 mb-6">
            <GraduationCap size={32} />
            <h1 className="text-xl font-bold tracking-tight text-slate-800">EduManager</h1>
          </div>
          
          <div className="flex gap-2 mb-6">
            <button 
              onClick={() => setViewMode('attendance')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                viewMode === 'attendance' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Calendar size={16} />
              Điểm danh
            </button>
            <button 
              onClick={() => setViewMode('tuition')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                viewMode === 'tuition' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Wallet size={16} />
              Học phí
            </button>
          </div>

          <button 
            onClick={() => setIsAddingClass(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-all shadow-sm font-medium"
          >
            <Plus size={18} />
            Thêm lớp mới
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">Danh sách lớp</div>
          {classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors ${
                selectedClass?.id === cls.id 
                  ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={18} className={selectedClass?.id === cls.id ? 'text-indigo-600' : 'text-slate-400'} />
                <span>{cls.name}</span>
              </div>
              {selectedClass?.id === cls.id && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>

        {isAddingClass && (
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <input
              autoFocus
              type="text"
              placeholder="Tên lớp..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddClass()}
            />
            <div className="flex gap-2">
              <button onClick={handleAddClass} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium">Lưu</button>
              <button onClick={() => setIsAddingClass(false)} className="flex-1 py-1.5 bg-slate-200 text-slate-700 rounded-md text-sm font-medium">Hủy</button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-bold text-slate-800">
              {selectedClass ? selectedClass.name : 'Chọn một lớp'}
            </h2>
            {viewMode === 'attendance' && (
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <Calendar size={16} className="text-slate-500" />
                <input 
                  type="date" 
                  className="bg-transparent border-none outline-none text-sm font-medium text-slate-700"
                  value={currentDate}
                  onChange={e => setCurrentDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {viewMode === 'attendance' && (
              <>
                <button 
                  onClick={exportMonthlyAttendancePDF}
                  disabled={!selectedClass}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                >
                  <FileDown size={18} />
                  Điểm danh tháng
                </button>
                <button 
                  onClick={() => setIsAddingStudent(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                >
                  <Plus size={18} />
                  Thêm học sinh
                </button>
                <button 
                  onClick={saveRecords}
                  disabled={isSaving || !selectedClass}
                  className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm font-semibold disabled:opacity-50"
                >
                  <Save size={18} />
                  {isSaving ? 'Đang lưu...' : 'Lưu tất cả'}
                </button>
              </>
            )}
            {viewMode === 'tuition' && (
              <div className="text-sm text-slate-500 font-medium italic">
                * Học phí được tính dựa trên 8 buổi/tháng và trừ đi các buổi vắng tháng trước.
              </div>
            )}
          </div>
        </header>

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-8">
          {viewMode === 'attendance' ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">STT</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Học sinh</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Điểm danh</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Cam/BTVN</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-48">Kiểm tra định kỳ</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nhận xét buổi học</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student, idx) => {
                    const record = records.find(r => r.student_id === student.id) || {
                      status: null,
                      camera: 0,
                      homework: 0,
                      test_score: '',
                      test_comment: '',
                      comment: ''
                    };

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <UserCircle size={16} className="text-slate-400" />
                            <span className="font-medium text-slate-700">{student.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => updateRecord(student.id, 'status', 'present')}
                              className={`p-1.5 rounded-md transition-all ${
                                record.status === 'present' ? 'bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              <CheckCircle2 size={20} />
                            </button>
                            <button
                              onClick={() => updateRecord(student.id, 'status', 'absent')}
                              className={`p-1.5 rounded-md transition-all ${
                                record.status === 'absent' ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              <XCircle size={20} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => updateRecord(student.id, 'camera', record.camera === 1 ? 0 : 1)}
                              className={`p-1.5 rounded-md transition-all ${
                                record.camera === 1 ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              <Camera size={20} />
                            </button>
                            <button
                              onClick={() => updateRecord(student.id, 'homework', record.homework === 1 ? 0 : 1)}
                              className={`p-1.5 rounded-md transition-all ${
                                record.homework === 1 ? 'bg-amber-100 text-amber-600 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              <BookOpen size={20} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5">
                            <input 
                              type="text"
                              placeholder="Điểm số..."
                              className="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                              value={record.test_score}
                              onChange={e => updateRecord(student.id, 'test_score', e.target.value)}
                            />
                            <input 
                              type="text"
                              placeholder="Nhận xét điểm..."
                              className="w-full px-2 py-1 border border-slate-100 rounded text-xs text-slate-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                              value={record.test_comment}
                              onChange={e => updateRecord(student.id, 'test_comment', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <textarea 
                            rows={1}
                            placeholder="Nhận xét buổi học..."
                            className="w-full bg-transparent border-none outline-none text-sm text-slate-600 placeholder:text-slate-300 resize-none"
                            value={record.comment}
                            onChange={e => updateRecord(student.id, 'comment', e.target.value)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <button onClick={() => exportStudentPDF(student)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                              <FileDown size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map(student => (
                <div key={student.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xl">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{student.name}</h3>
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Học sinh</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Học phí / buổi</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={student.tuition_rate}
                            onChange={e => updateStudentTuition(student.id, parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Số buổi dự kiến</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                          value={student.planned_sessions}
                          onChange={e => updateStudentSessions(student.id, parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => exportTuitionPDF(student)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl font-bold transition-all border border-indigo-100"
                  >
                    <FileDown size={18} />
                    Xuất phiếu học phí
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Student Modal */}
      <AnimatePresence>
        {isAddingStudent && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-800 mb-6">Thêm học sinh mới</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1.5">Họ và tên học sinh</label>
                  <input
                    autoFocus type="text" placeholder="Ví dụ: Nguyễn Văn A"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={newStudentName} onChange={e => setNewStudentName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Học phí / buổi</label>
                    <input
                      type="number" placeholder="200000"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newStudentTuition} onChange={e => setNewStudentTuition(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Số buổi dự kiến</label>
                    <input
                      type="number" placeholder="8"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newStudentSessions} onChange={e => setNewStudentSessions(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={handleAddStudent} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md">Thêm ngay</button>
                  <button onClick={() => setIsAddingStudent(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all">Hủy bỏ</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
