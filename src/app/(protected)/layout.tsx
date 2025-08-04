import { NavigationSidebar } from "@/components/navigation-sidebar";

export default function ProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
			<div className="flex h-screen">
				<NavigationSidebar />
				<div className="flex-1 overflow-hidden">
					{children}
				</div>
			</div>
	);
}
