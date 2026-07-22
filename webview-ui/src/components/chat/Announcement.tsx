import { memo } from "react"

interface AnnouncementProps {
	hideAnnouncement: () => void
}

const Announcement = ({ hideAnnouncement }: AnnouncementProps) => {
	hideAnnouncement()
	return null
}

export default memo(Announcement)
