class Tooltip {
    constructor() {
        this.tooltipElement = null;
        this.timer = null;
    }

    show(event, imageUrl) {
        // Clear any existing timer
        if (this.timer) {
            clearTimeout(this.timer);
        }

        // Set a timer to show the tooltip after a delay
        this.timer = setTimeout(() => {
            // Create tooltip element if it doesn't exist
            if (!this.tooltipElement) {
                this.tooltipElement = document.createElement('div');
                this.tooltipElement.className = 'image-tooltip';
                document.body.appendChild(this.tooltipElement);
            }

            // Set the content
            this.tooltipElement.innerHTML = `<img src="${imageUrl}" style="max-width: 300px; max-height: 300px; object-fit: contain;">`;

            // Position the tooltip
            this.updatePosition(event);

            // Make it visible
            this.tooltipElement.style.display = 'block';

            // Add a mousemove listener to the target to update position
            event.target.addEventListener('mousemove', this.updatePosition.bind(this));

        }, 300); // 300ms delay
    }

    hide(event) {
        // Clear the timer if the mouse leaves before the tooltip is shown
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        // Hide and remove the tooltip if it exists
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
            // It's better to remove the element to keep the DOM clean
            this.tooltipElement.remove();
            this.tooltipElement = null;
        }

        // Remove the mousemove listener
        if (event && event.target) {
            event.target.removeEventListener('mousemove', this.updatePosition.bind(this));
        }
    }

    updatePosition(event) {
        if (this.tooltipElement) {
            // Position tooltip near the cursor, with an offset
            let x = event.clientX + 15;
            let y = event.clientY + 15;

            // Adjust position if it goes off-screen
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const tooltipRect = this.tooltipElement.getBoundingClientRect();

            if (x + tooltipRect.width > screenWidth) {
                x = event.clientX - tooltipRect.width - 15;
            }
            if (y + tooltipRect.height > screenHeight) {
                y = event.clientY - tooltipRect.height - 15;
            }

            this.tooltipElement.style.left = `${x}px`;
            this.tooltipElement.style.top = `${y}px`;
        }
    }
}

// Create a single, global instance of the Tooltip class.
// This ensures that all scripts on a page share the same tooltip,
// preventing multiple tooltips from appearing.
var tooltip = tooltip || new Tooltip();
