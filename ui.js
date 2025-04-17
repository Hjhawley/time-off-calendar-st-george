export function showToast(message, duration = 2000) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            toast.classList.add("hidden");
        }, 300);
    }, duration);
}

export function updateDayStyles() {
    const rootStyles = getComputedStyle(document.documentElement);
    const selectHighlight = rootStyles.getPropertyValue('--select-highlight').trim();
    const dayComplete = rootStyles.getPropertyValue('--day-complete').trim();

    document.querySelectorAll('.day').forEach(dayDiv => {
        const selects = dayDiv.querySelectorAll('select');
        let selectedCount = 0;

        selects.forEach(select => {
            if (select.value !== "") {
                select.style.backgroundColor = selectHighlight;
                selectedCount++;
            } else {
                select.style.backgroundColor = "";
            }
        });

        if (selectedCount === selects.length) {
            dayDiv.style.backgroundColor = dayComplete;
        } else {
            dayDiv.style.backgroundColor = "";
        }
    });
}
