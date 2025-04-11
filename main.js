import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let calendar;
let currentTeacherFilter = "";

const colorMap = {
  "MS DAHLIA": "#8B0000",
  "MS ARDELYA": "#1E90FF",
  "MS SAFA": "#2E8B57",
  "MS MELLY": "#B8860B",
  "MR DIMAS": "#A0522D",
};

function hideForUser() {
  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get("role") || "admin"; // default admin jika tidak ada param

  if (role === "user") {
    // Sembunyikan tombol tambah jadwal (hanya saat awal halaman)
    const addScheduleBtn = document.querySelector(
      'button[onclick="showModal()"]'
    );
    if (addScheduleBtn) addScheduleBtn.remove();

    // Sembunyikan icon settings (harus dipanggil setelah render)
    const settingsIcons = document.querySelectorAll(".settings-icon");
    settingsIcons.forEach((icon) => icon.remove());
  }
}

const filterTeacherSelect = document.getElementById("filterTeacher");
if (filterTeacherSelect) {
  filterTeacherSelect.addEventListener("change", (e) => {
    currentTeacherFilter = e.target.value;
    loadEvents();
    if (calendar) calendar.refetchEvents();
  });
}

function addWeeklyButton(calendar) {
  const weeklyButton = document.createElement("button");
  weeklyButton.innerText = "week";
  weeklyButton.classList.add("fc-button", "fc-button-primary");
  weeklyButton.addEventListener("click", () => {
    calendar.changeView("timeGridWeek");
  });

  const calendarHeader = document.querySelector(".fc-header-toolbar");
  if (calendarHeader) {
    calendarHeader.appendChild(weeklyButton);
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  // Tampilkan loading saat inisialisasi kalender
  Swal.fire({
    title: "Loading Calendar...",
    text: "Please wait a moment",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  // Inisialisasi kalender
  const calendarEl = document.getElementById("calendar");
  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get("role") || "admin"; // default admin jika tidak ada param

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "en-US",
    displayEventEnd: true,
    editable: role === "admin",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,listWeek",
    },

    eventDrop: async function (info) {
      const { event } = info;

      try {
        const visualStart = event.start;
        const visualEnd = event.end;
        const oneDay = 24 * 60 * 60 * 1000;

        let updatedStart, updatedEnd;

        // Hitung durasi visual event
        const visualDuration = visualEnd
          ? visualEnd.getTime() - visualStart.getTime()
          : 0;

        if (!visualEnd || visualDuration <= oneDay) {
          // ✅ Event hanya 1 hari → koreksi end - 1 hari lalu set start = end
          const correctedEnd = new Date(visualEnd.getTime() - 1);
          updatedEnd = correctedEnd.toISOString().split("T")[0];
          updatedStart = updatedEnd;
        } else {
          // ✅ Multi-day event → koreksi end dengan -1 hari
          updatedStart = event.start.toISOString().split("T")[0];
          const correctedEnd = new Date(event.end.getTime() - 1);
          updatedEnd = correctedEnd.toISOString().split("T")[0];

          const rawStart = new Date(event.start.getTime() + oneDay);
          updatedStart = rawStart.toISOString().split("T")[0];
        }

        await updateEventDate(event.id, updatedStart, updatedEnd);

        event.setExtendedProp("originalEnd", updatedEnd);

        Swal.fire({
          icon: "success",
          title: "Schedule Updated",
          text: "The event date has been updated successfully.",
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          window.location.reload();
        });
      } catch (error) {
        console.error("Failed to update event:", error);
        Swal.fire("Error", "Could not update event.", "error");
        info.revert();
      }
    },

    eventClick: function (info) {
      const { title, start, extendedProps } = info.event;
      const { branch, timeStart, timeEnd, lesson, originalEnd } = extendedProps;

      const formattedStart = new Date(start).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const formattedEnd = new Date(
        originalEnd || info.event.end
      ).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const dateDisplay =
        formattedStart === formattedEnd
          ? formattedStart
          : `${formattedStart} - ${formattedEnd}`;

      const message = `
            <div style="font-size: 16px; line-height: 1.6; text-align: center;">
              <div style="font-weight: bold; font-size: 18px; margin-bottom: 8px;">
                ${title} - ${branch}
              </div>
              <div style="margin-bottom: 6px;">${dateDisplay}</div>
              <div>${timeStart} - ${timeEnd}</div>
              <div>${lesson}</div>
            </div>
          `;

      Swal.fire({
        title: "Schedule Detail",
        html: message,
        confirmButtonText: "OK",
      });
    },

    events: async function (fetchInfo, successCallback, failureCallback) {
      try {
        let events = [];
        const snapshot = await getDocs(collection(db, "events"));

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (currentTeacherFilter && data.teacher !== currentTeacherFilter)
            return;

          events.push({
            id: doc.id,
            title: `${data.teacher}`,
            timeStart: data.timeStart,
            timeEnd: data.timeEnd,
            lesson: data.lesson,
            branch: data.branch,
            originalEnd: data.end,
            start: data.start,
            end: new Date(
              new Date(data.end).setDate(new Date(data.end).getDate() + 1)
            )
              .toISOString()
              .split("T")[0],
            backgroundColor: colorMap[data.teacher] || "#D3D3D3",
          });
        });

        events.sort((a, b) => {
          const dateA = new Date(a.start);
          const dateB = new Date(b.start);
          if (dateA.getTime() === dateB.getTime()) {
            return a.timeStart.localeCompare(b.timeStart);
          }
          return dateA - dateB;
        });

        successCallback(events);
      } catch (error) {
        console.error("Error loading events:", error);
        failureCallback(error);
        Swal.fire("Error", "Gagal memuat jadwal.", "error");
      }
    },

    eventContent: function (arg) {
      const bgColor = colorMap[arg.event.title] || "#123456";
      return {
        html: `
              <div class="calendar-event" style="background-color: ${bgColor}; padding: 2px; border-radius: 4px;">
                <strong>${arg.event.title} - ${arg.event.extendedProps.branch}</strong><br>
                <span>${arg.event.extendedProps.timeStart} - ${arg.event.extendedProps.timeEnd}</span><br>
                <span>${arg.event.extendedProps.lesson}</span>
              </div>
            `,
      };
    },
  });

  await loadEvents();
  calendar.render();
  addWeeklyButton(calendar);
  Swal.close();

  // --- Interaksi tambahan ---
  const addTeacherBtn = document.getElementById("addTeacherBtn");
  if (addTeacherBtn) {
    addTeacherBtn.addEventListener("click", addTeacherField);
  }

  const eventModal = document.getElementById("eventModal");
  if (eventModal) {
    eventModal.style.display = "none";
  }

  const startDateInput = document.getElementById("eventStartDate");
  const endDateInput = document.getElementById("eventEndDate");
  if (startDateInput && endDateInput) {
    startDateInput.addEventListener("change", function () {
      endDateInput.setAttribute("min", this.value);
    });
  }

  const startTimeInput = document.getElementById("eventStartTime");
  const endTimeSelect = document.getElementById("eventEndTime");

  if (startTimeInput && endTimeSelect) {
    startTimeInput.addEventListener("change", function () {
      let startTime = this.value;
      let currentEndTime = endTimeSelect.value;

      let optionsHTML = `
            <option value="">Select Time</option>
            <option value="14.45">14.45</option>
            <option value="16.30">16.30</option>
            <option value="18.00">18.00</option>
            <option value="19.45">19.45</option>
          `;
      endTimeSelect.innerHTML = optionsHTML;

      Array.from(endTimeSelect.options).forEach((option) => {
        if (option.value && option.value <= startTime) {
          option.remove();
        }
      });

      if (currentEndTime && currentEndTime > startTime) {
        endTimeSelect.value = currentEndTime;
      }
    });
  }
});

async function updateEventDate(id, start, end) {
  const eventRef = doc(db, "events", id);
  await updateDoc(eventRef, {
    start: start,
    end: end,
  });
}

const timeOptions = ["14.45", "16.30", "18.00", "19.45"];

function filterEndTimeOptions(startTime, endTimeSelect) {
  const currentEndTime = endTimeSelect.value;
  let optionsHTML = `<option value="">Select Time</option>`;

  timeOptions.forEach((time) => {
    if (time > startTime) {
      optionsHTML += `<option value="${time}">${time}</option>`;
    }
  });

  endTimeSelect.innerHTML = optionsHTML;

  if (currentEndTime && currentEndTime > startTime) {
    endTimeSelect.value = currentEndTime;
  }
}

const startDateInput = document.getElementById("eventStartDate");
const endDateInput = document.getElementById("eventEndDate");
const startTimeInput = document.getElementById("eventStartTime");
const endTimeSelect = document.getElementById("eventEndTime");

if (startDateInput && endDateInput) {
  startDateInput.addEventListener("change", function () {
    endDateInput.setAttribute("min", this.value);
  });
}

if (startTimeInput && endTimeSelect) {
  startTimeInput.addEventListener("change", function () {
    filterEndTimeOptions(this.value, endTimeSelect);
  });
}

// Tambahkan variabel global untuk pagination
let currentPage = 1;
const eventsPerPage = 4;

// Bersihkan dan load event list dari Firestore
async function loadEvents() {
  const eventList = document.getElementById("eventList");
  if (!eventList) return;
  eventList.innerHTML = "";

  const snapshot = await getDocs(collection(db, "events"));
  const events = [];

  snapshot.forEach((doc) => {
    const event = doc.data();
    if (currentTeacherFilter && event.teacher !== currentTeacherFilter) return;
    event.id = doc.id;
    events.push(event);
  });

  events.sort((a, b) => {
    const startA = new Date(a.start);
    const startB = new Date(b.start);
    if (startA.getTime() === startB.getTime()) {
      const endA = new Date(a.end);
      const endB = new Date(b.end);
      return endA.getTime() === endB.getTime()
        ? a.timeStart.localeCompare(b.timeStart)
        : endA - endB;
    }
    return startA - startB;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startIndex = (currentPage - 1) * eventsPerPage;
  const paginatedEvents = events.slice(startIndex, startIndex + eventsPerPage);

  paginatedEvents.forEach((event) => {
    const li = createEventElement(event, today);

    eventList.appendChild(li);
    hideForUser();
  });

  renderPagination(events.length);
  calendar?.refetchEvents();
}

function createEventElement(event, today) {
  const li = document.createElement("li");
  li.className = "event-item";

  const endDate = new Date(event.end);
  endDate.setHours(0, 0, 0, 0);
  if (endDate < today) li.style.backgroundColor = "#c01a51";

  li.innerHTML = `
      <div class="event-details">
        <span class="event-teacher">${event.teacher.toUpperCase()} - ${event.branch.toUpperCase()}</span>
        <span class="event-date">
          ${
            event.start === event.end
              ? formatDate(event.start)
              : `${formatDate(event.start)} - ${formatDate(event.end)}`
          }
        </span>
        <span class="event-time">${event.timeStart} - ${event.timeEnd}</span>
        <span class="event-lesson">${event.lesson}</span>
      </div>
      <span class="settings-icon" style="cursor: pointer;" onclick="toggleOptions('${
        event.id
      }')">⚙️</span>
      <div id="options-${
        event.id
      }" class="event-options" style="display: none;">
        <button onclick="editEvent('${event.id}', '${event.teacher}', '${
    event.lesson
  }', '${event.branch}', '${event.start}', '${event.end}', '${
    event.timeStart
  }', '${event.timeEnd}')">Edit</button>
        <button onclick="duplicateEvent('${event.id}')">Dup</button>
        <button onclick="deleteEvent('${event.id}')">Delete</button>
      </div>
    `;

  return li;
}

// Tambahkan fungsi duplicateEvent dengan loading
window.duplicateEvent = async function (id) {
  Swal.fire({
    title: "Duplicate Schedule?",
    text: "This will create a copy of the selected schedule.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Duplicate",
    cancelButtonText: "Cancel",
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Waiting...",
        text: "Please wait a moment.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const docRef = doc(db, "events", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();

        await addDoc(collection(db, "events"), {
          teacher: data.teacher,
          lesson: data.lesson,
          branch: data.branch,
          start: data.start,
          end: data.end,
          timeStart: data.timeStart,
          timeEnd: data.timeEnd,
        });

        await loadEvents();

        Swal.fire({
          title: "Duplicated!",
          text: "Schedule duplicated successfully.",
          icon: "success",
        });
      } else {
        Swal.fire({
          title: "Error",
          text: "Original schedule not found.",
          icon: "error",
        });
      }
    }
  });
};

function renderPagination(totalEvents) {
  const paginationContainer = document.getElementById("pagination");
  paginationContainer.innerHTML = "";
  const totalPages = Math.ceil(totalEvents / eventsPerPage);

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = startPage + maxVisiblePages - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  // Tombol Previous
  const prevButton = document.createElement("button");
  prevButton.textContent = "«";
  prevButton.disabled = currentPage === 1;
  prevButton.classList.add("page-button");
  prevButton.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadEvents();
    }
  });
  paginationContainer.appendChild(prevButton);

  // Tambahkan titik-titik jika ada halaman tersembunyi di awal
  if (startPage > 1) {
    const firstPage = document.createElement("button");
    firstPage.textContent = "1";
    firstPage.classList.add("page-button");
    firstPage.addEventListener("click", () => {
      currentPage = 1;
      loadEvents();
    });
    paginationContainer.appendChild(firstPage);

    const dots = document.createElement("span");
    dots.textContent = "...";
    dots.classList.add("dots");
    paginationContainer.appendChild(dots);
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.classList.add("page-button");
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => {
      currentPage = i;
      loadEvents();
    });
    paginationContainer.appendChild(button);
  }

  // Tambahkan titik-titik jika ada halaman tersembunyi di akhir
  if (endPage < totalPages) {
    const dots = document.createElement("span");
    dots.textContent = "...";
    dots.classList.add("dots");
    paginationContainer.appendChild(dots);

    const lastPage = document.createElement("button");
    lastPage.textContent = totalPages;
    lastPage.classList.add("page-button");
    lastPage.addEventListener("click", () => {
      currentPage = totalPages;
      loadEvents();
    });
    paginationContainer.appendChild(lastPage);
  }

  // Tombol Next
  const nextButton = document.createElement("button");
  nextButton.textContent = "»";
  nextButton.disabled = currentPage === totalPages;
  nextButton.classList.add("page-button");
  nextButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadEvents();
    }
  });
  paginationContainer.appendChild(nextButton);
}

let editingEventId = null;

const teacherOptions = [
  "MS DAHLIA",
  "MS ARDELYA",
  "MS SAFA",
  "MS MELLY",
  "MR DIMAS",
];

function updateTeacherSelectOptions() {
  const selectedValues = Array.from(document.querySelectorAll(".eventTeacher"))
    .map((s) => s.value)
    .filter((val) => val);

  document.querySelectorAll(".eventTeacher").forEach((select) => {
    const currentValue = select.value;
    select.innerHTML =
      '<option value="">Select Teacher</option>' +
      teacherOptions
        .filter((opt) => opt === currentValue || !selectedValues.includes(opt))
        .map((opt) => `<option value="${opt}">${opt}</option>`) // keep selected
        .join("");
    select.value = currentValue;
  });
}

window.addTeacherField = function () {
  const container = document.getElementById("teacherContainer");
  const select = document.createElement("select");
  select.className = "eventTeacher";
  select.required = true;
  container.appendChild(select);
  updateTeacherSelectOptions();

  select.addEventListener("change", updateTeacherSelectOptions);
};

window.saveEvent = async function () {
  const teacherSelects = document.querySelectorAll(".eventTeacher");
  const teachers = Array.from(teacherSelects)
    .map((select) => select.value)
    .filter((val) => val);

  let lesson = document.getElementById("eventLesson").value;
  let branch = document.getElementById("eventBranch").value;
  let startDate = document.getElementById("eventStartDate").value;
  let startTime = document.getElementById("eventStartTime").value;
  let endDate = document.getElementById("eventEndDate").value;
  let endTime = document.getElementById("eventEndTime").value;

  if (
    teachers.length > 0 &&
    branch &&
    startDate &&
    startTime &&
    endDate &&
    endTime
  ) {
    Swal.fire({
      title: "Waiting...",
      text: "Please wait a moment.",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    if (editingEventId) {
      // Hapus dokumen lama
      await deleteDoc(doc(db, "events", editingEventId));
      editingEventId = null;
    }

    // Tambahkan semua teacher baru
    for (let teacher of teachers) {
      await addDoc(collection(db, "events"), {
        teacher,
        lesson: lesson || "", // Lesson sekarang opsional
        branch,
        start: startDate,
        end: endDate,
        timeStart: startTime,
        timeEnd: endTime,
      });
    }

    await loadEvents();
    document.getElementById("eventForm").reset();

    // Reset teacher fields: hapus semua select kecuali satu
    const container = document.getElementById("teacherContainer");
    const selects = container.querySelectorAll("select.eventTeacher");
    selects.forEach((select, index) => {
      if (index === 0) {
        select.value = "";
      } else {
        select.remove();
      }
    });

    closeModal();

    Swal.fire({
      title: "Success!",
      text: "The schedule has been saved successfully.",
      icon: "success",
      confirmButtonText: "OK",
    });
  } else {
    Swal.fire({
      title: "Error!",
      text: "Please fill in all the required data!", //ubah pesan error
      icon: "error",
      confirmButtonText: "OK",
    });
  }
};

window.editEvent = function (
  id,
  teacher,
  lesson,
  branch,
  start,
  end,
  timeStart,
  timeEnd
) {
  // Reset container dan isi ulang satu teacher
  const teacherContainer = document.getElementById("teacherContainer");
  teacherContainer.innerHTML = `
      <label>Teachers:</label>
      <select class="eventTeacher" required>
        <option value="">Select Teacher</option>
        <option value="MS DAHLIA">MS DAHLIA</option>
        <option value="MS ARDELYA">MS ARDELYA</option>
        <option value="MS SAFA">MS SAFA</option>
        <option value="MS MELLY">MS MELLY</option>
        <option value="MR DIMAS">MR DIMAS</option>
      </select>
    `;
  teacherContainer.querySelector("select").value = teacher;

  document.getElementById("eventLesson").value = lesson;
  document.getElementById("eventBranch").value = branch;
  document.getElementById("eventStartDate").value = start;
  document.getElementById("eventStartTime").value = timeStart;
  document.getElementById("eventEndDate").value = end;
  document.getElementById("eventEndTime").value = timeEnd;
  editingEventId = id;

  Swal.fire({
    title: "Edit Schedule",
    text: "Please update the data for this schedule",
    icon: "info",
    confirmButtonText: "OK",
  }).then((result) => {
    if (result.isConfirmed) {
      showModal(); // Modal hanya muncul jika user klik OK
    }
  });
};

window.deleteEvent = async function (id) {
  Swal.fire({
    title: "Are YOU Sure?",
    text: "This schedule will be permanently deleted!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, Delete it!",
    cancelButtonText: "Cancel",
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Waiting...",
        text: "Please wait a moment.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      await deleteDoc(doc(db, "events", id));

      const snapshot = await getDocs(collection(db, "events"));
      const totalEvents = snapshot.size;
      const totalPages = Math.ceil(totalEvents / eventsPerPage);

      if (currentPage > totalPages && currentPage > 1) {
        currentPage = totalPages;
      }

      await loadEvents();

      Swal.fire({
        title: "Deleted!",
        text: "Schedule deleted successfully!",
        icon: "success",
        confirmButtonText: "OK",
      });
    }
  });
};

window.showModal = function () {
  document.getElementById("eventModal").style.display = "inline-block";
};

window.closeModal = function () {
  document.getElementById("eventModal").style.display = "none";
  document.getElementById("eventForm").reset();
  editingEventId = null;
};

window.toggleOptions = function (id) {
  let optionsDiv = document.getElementById(`options-${id}`);
  optionsDiv.style.display =
    optionsDiv.style.display === "none" ? "inline-block" : "none";
};

function formatDate(dateString) {
  const options = { year: "numeric", month: "long", day: "numeric" };
  return new Date(dateString).toLocaleDateString("en-US", options);
}
