<script>
	import { page } from '$app/stores';

	const pagesConfigs = [
		{
			path: '/',
			title: 'Index',
			prefetch: true
		},
		{
			path: '/components',
			title: 'Components',
			prefetch: true
		}
	];
</script>

<header class="bg-gray-100 w-full flex justify-center">
	<nav class=" max-w-screen-xl w-full flex items-center justify-center  bg-red-100 py-5 px-5 ">
		<ul class="flex    w-full items-center ">
			<li class=" mr-12  mt-0   mt-2   ">
				
			</li>
			{#each pagesConfigs as pageConfig}
				<li
					class="text-gray-600  mr-5 font-regular "
					class:active={$page.url.pathname === pageConfig.path}
				>
					<a rel={pageConfig.prefetch ? 'prefetch' : undefined} href={pageConfig.path}
						>{pageConfig.title}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
</header>

<style>
	.active a {
		color: #000;
		font-weight: medium;
	}
</style>
