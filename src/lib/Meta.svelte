<script>
    export let title = "Interactive visualization";
    export let siteName = "Interactive visualization";
    export let description = "Interactive, data story";
    export let url = "/";
    export let keywords = "Svelte, d3, visualization ";
    export let author = "David B.";
    // export let preloadFont = [];
    //add favicon to head
   </script>
   
   <svelte:head>
    <title>{title}</title>
    <!-- <link
         rel="icon"
         type="image/svg+xml"
         href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='16' height='16' viewBox='0 0 16 16'%3E%3Cdefs%3E%3CclipPath id='clip-yorku_careerbrain_favicon'%3E%3Crect width='16' height='16'/%3E%3C/clipPath%3E%3C/defs%3E%3Cg id='yorku_careerbrain_favicon' clip-path='url(%23clip-yorku_careerbrain_favicon)'%3E%3Crect width='16' height='16' fill='%23fff'/%3E%3Crect id='Rectangle_1655' data-name='Rectangle 1655' width='16' height='16' fill='%23474260'/%3E%3Cg id='Group_2697' data-name='Group 2697' transform='translate(-8187 10057.34)'%3E%3Cpath id='Path_1237' data-name='Path 1237' d='M5.948,32.285c-.307,0-.613.005-.918-.007-.039,0-.1-.088-.108-.144A1.729,1.729,0,0,0,4.108,30.9a2.072,2.072,0,0,0-2.876.948,3.031,3.031,0,0,0,.057,2.529,1.932,1.932,0,0,0,2.044,1.052,1.653,1.653,0,0,0,1.593-1.472c.012-.05.067-.126.1-.127.306-.01.612-.006.933-.006a2.584,2.584,0,0,1-1.606,2.245,3.175,3.175,0,0,1-3.52-.676,3.722,3.722,0,0,1-.184-4.456A2.872,2.872,0,0,1,2.828,29.8a2.961,2.961,0,0,1,2.386.81,2.521,2.521,0,0,1,.734,1.67' transform='translate(8188 -10081.979)' fill='%23fff'/%3E%3Cpath id='Path_1238' data-name='Path 1238' d='M463.054,0V.4c0,.68-.03,1.361.009,2.038a4.159,4.159,0,0,1-.3,1.553c-.016.05-.032.1-.046.151a.36.36,0,0,0,.007.077,3.538,3.538,0,0,0,.4-.006c.039,0,.084-.074.1-.123a2.592,2.592,0,0,1,4.861.378,4.37,4.37,0,0,1-.239,3.414,2.3,2.3,0,0,1-2.1,1.318,4.12,4.12,0,0,1-1.152-.151,2.04,2.04,0,0,1-1.3-1.2c-.145-.31-.21-.341-.582-.253.078.5.4.94.333,1.485H461.1V0Zm-.013,5.863.016,0c0,.079,0,.159,0,.237a1.3,1.3,0,0,0,.925,1.246,2.563,2.563,0,0,0,1.421,0,1.129,1.129,0,0,0,.7-.517,1.919,1.919,0,0,0,.077-1.746,1.045,1.045,0,0,0-.631-.6,2.5,2.5,0,0,0-1.563-.053,1.19,1.19,0,0,0-.9,1c-.027.141-.033.287-.049.43' transform='translate(7733.696 -10054.84)' fill='%23fff'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A"
       /> -->
    <meta name="description" content={description} />
    <meta name="author" content={author} />
    <meta name="news_keywords" content={keywords} />
   
    <meta property="og:title" content={title} />
    <meta property="og:site_name" content={siteName} />
    <meta property="og:url" content={url} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="en_US" />
   
    <meta property="og:image" content="{url}/images/site_image.svg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="600" />
   
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content={url} />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image:src" content="{url}/images/site_image.svg" />
   
    <meta name="robots" content="max-image-preview:large" />
   
    <link rel="canonical" href="{url}/" />
   
    <!-- {#each preloadFont as href}
         <link rel="preload" {href} as="font" type="font/woff2" crossorigin />
       {/each} -->
   </svelte:head>